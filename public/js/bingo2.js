const BOARD_SIZE = 10;
const SPEC_OPTIONS = [
  { target: 3, name: "三连", guarantee: 2288 },
  { target: 4, name: "四连", guarantee: 4888 },
  { target: 5, name: "五连", guarantee: 11000 },
  { target: 6, name: "六连", guarantee: 13888 },
  { target: 7, name: "七连", guarantee: 18888 },
  { target: 8, name: "八连", guarantee: 21888 },
  { target: 9, name: "九连", guarantee: 25888 },
  { target: 10, name: "十连", guarantee: 36666 }
];
const CATEGORY_COUNTS = {
  small_red: 57,
  big_red: 24,
  super_red: 14,
  room_card: 4,
  colorful: 1
};
const EXCLUDED_ITEM_IDS = new Set(["heart-of-africa", "tear-of-the-ocean"]);

const state = {
  spec: 3,
  initialBase: 2288,
  base: 2288,
  board: [],
  marked: [],
  longestLine: 0,
  completedLine: [],
  lineReached: false,
  settled: false,
  history: [],
  logEntries: []
};

let itemData = [];
let sessionId = null;
let roomCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || "";
let roomRevision = -1;
let saveTimer = null;
let confirmTimer = null;
let isApplyingRemote = false;
let pendingRoomMessages = [];
let searchHighlightTimer = null;

const els = {
  specGrid: document.querySelector("#specGrid"),
  currentSpecText: document.querySelector("#currentSpecText"),
  longestLine: document.querySelector("#longestLine"),
  markedCount: document.querySelector("#markedCount"),
  baseValue: document.querySelector("#baseValue"),
  bombBtn: document.querySelector("#bombBtn"),
  withdrawInput: document.querySelector("#withdrawInput"),
  withdrawBtn: document.querySelector("#withdrawBtn"),
  lineCondition: document.querySelector("#lineCondition"),
  baseCondition: document.querySelector("#baseCondition"),
  gameMessage: document.querySelector("#gameMessage"),
  log: document.querySelector("#log"),
  undoBtn: document.querySelector("#undoBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  boardSearchForm: document.querySelector("#boardSearchForm"),
  boardSearchInput: document.querySelector("#boardSearchInput"),
  boardSearchMessage: document.querySelector("#boardSearchMessage"),
  bingoBoard: document.querySelector("#bingoBoard"),
  boardStatus: document.querySelector("#boardStatus"),
  settleBtn: document.querySelector("#settleBtn"),
  statusPill: document.querySelector("#statusPill"),
  saveStatus: document.querySelector("#saveStatus"),
  roomBar: document.querySelector("#roomBar"),
  roomCodeText: document.querySelector("#roomCodeText"),
  roomSyncText: document.querySelector("#roomSyncText")
};

function getSpec(target = state.spec) {
  return SPEC_OPTIONS.find((item) => item.target === Number(target)) || SPEC_OPTIONS[0];
}

function formatGuarantee(value) {
  return Number(value).toLocaleString("zh-CN");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function generateBoard() {
  const board = [];
  const redCategories = ["small_red", "big_red", "super_red"];

  redCategories.forEach((category) => {
    const pool = itemData.filter((item) => item.category === category && !EXCLUDED_ITEM_IDS.has(item.id));
    for (let index = 0; index < CATEGORY_COUNTS[category]; index += 1) {
      const item = randomItem(pool);
      board.push({
        key: `${item.id}-${category}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        type: category,
        itemId: item.id,
        name: item.name,
        value: item.value,
        imageUrl: `/assets/bingo2/${item.id}.webp`
      });
    }
  });

  for (let index = 0; index < CATEGORY_COUNTS.room_card; index += 1) {
    board.push({
      key: `room-card-${index}-${Math.random().toString(36).slice(2, 8)}`,
      type: "room_card",
      itemId: "room-card",
      name: "房卡",
      value: 0,
      imageUrl: ""
    });
  }

  board.push({
    key: `colorful-${Math.random().toString(36).slice(2, 8)}`,
    type: "colorful",
    itemId: "colorful",
    name: "炫彩",
    value: 0,
    imageUrl: ""
  });

  return shuffle(board);
}

function addLog(text) {
  state.logEntries.unshift({
    text,
    time: new Date().toLocaleString("zh-CN", { hour12: false })
  });
  state.logEntries = state.logEntries.slice(0, 160);
  pendingRoomMessages.push(text);
  renderLog();
}

function renderLog() {
  if (!state.logEntries.length) {
    els.log.innerHTML = "<p>暂无操作记录。</p>";
    return;
  }
  els.log.innerHTML = state.logEntries
    .map((item) => `<p>${escapeHtml(item.time)} · ${escapeHtml(item.text)}</p>`)
    .join("");
}

function setMessage(text) {
  els.gameMessage.textContent = text;
}

function setSearchMessage(text, isError = false) {
  els.boardSearchMessage.textContent = text;
  els.boardSearchMessage.classList.toggle("error", isError);
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

function findSearchMatches(query) {
  const normalizedQuery = normalizeSearchText(query);
  const exact = [];
  const partial = [];
  state.board.forEach((cell, index) => {
    const normalizedName = normalizeSearchText(cell.name);
    if (normalizedName === normalizedQuery) exact.push(index);
    else if (normalizedName.includes(normalizedQuery)) partial.push(index);
  });
  return [...exact, ...partial];
}

function clearSearchHighlight() {
  clearTimeout(searchHighlightTimer);
  els.bingoBoard.querySelectorAll(".search-target").forEach((cell) => cell.classList.remove("search-target"));
}

function highlightSearchTarget(index) {
  const target = els.bingoBoard.querySelector(`[data-cell-index="${index}"]`);
  if (!target) return;
  clearSearchHighlight();
  target.classList.remove("search-target");
  void target.offsetWidth;
  target.classList.add("search-target");
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  searchHighlightTimer = setTimeout(() => target.classList.remove("search-target"), 2600);
}

function hasStarted() {
  const hasRoundAction = state.history.some((action) => action.type !== "spec");
  return hasRoundAction || state.marked.length > 0 || state.base !== state.initialBase || state.lineReached || state.settled;
}

function readAmount() {
  const value = Number(els.withdrawInput.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function findLongestLine(markedIndices) {
  const marked = new Set(markedIndices);
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  let best = [];

  for (const index of marked) {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;

    for (const [rowStep, colStep] of directions) {
      const previousRow = row - rowStep;
      const previousCol = col - colStep;
      const previousIndex = previousRow * BOARD_SIZE + previousCol;
      const previousInside = previousRow >= 0
        && previousRow < BOARD_SIZE
        && previousCol >= 0
        && previousCol < BOARD_SIZE;
      if (previousInside && marked.has(previousIndex)) continue;

      const line = [];
      let nextRow = row;
      let nextCol = col;
      while (
        nextRow >= 0
        && nextRow < BOARD_SIZE
        && nextCol >= 0
        && nextCol < BOARD_SIZE
      ) {
        const nextIndex = nextRow * BOARD_SIZE + nextCol;
        if (!marked.has(nextIndex)) break;
        line.push(nextIndex);
        nextRow += rowStep;
        nextCol += colStep;
      }
      if (line.length > best.length) best = line;
    }
  }
  return best;
}

function updateLineState({ allowLock = true } = {}) {
  const best = findLongestLine(state.marked);
  state.longestLine = best.length;
  if (allowLock && !state.lineReached && best.length >= state.spec) {
    state.lineReached = true;
    state.completedLine = best.slice(0, state.spec);
    addLog(`达成${getSpec().name}：棋盘已锁定`);
    setMessage(`已连续点亮 ${best.length} 格，棋盘已锁定。请继续完成基础保底。`);
  }
}

function renderSpecs() {
  els.specGrid.innerHTML = SPEC_OPTIONS.map((spec) => `
    <button
      class="spec-btn ${spec.target === state.spec ? "active" : ""}"
      type="button"
      data-spec="${spec.target}"
      ${hasStarted() ? "disabled" : ""}
    >
      <strong>${spec.name}</strong>
      <span>保底 ${formatGuarantee(spec.guarantee)}W</span>
    </button>
  `).join("");
}

function categoryLabel(type) {
  return {
    small_red: "小红",
    big_red: "大红",
    super_red: "超大红",
    room_card: "房卡",
    colorful: "炫彩"
  }[type] || "";
}

function renderBoard() {
  const marked = new Set(state.marked);
  const completed = new Set(state.completedLine);
  const locked = state.lineReached || state.settled;
  els.bingoBoard.innerHTML = state.board.map((cell, index) => {
    const isSpecial = cell.type === "room_card" || cell.type === "colorful";
    const valueText = cell.value ? `，价值 ${formatGuarantee(cell.value)} 哈夫币` : "";
    return `
      <button
        class="bingo-cell ${cell.type} ${marked.has(index) ? "marked" : ""} ${completed.has(index) ? "completed" : ""}"
        type="button"
        data-cell-index="${index}"
        aria-pressed="${marked.has(index)}"
        title="${escapeHtml(cell.name)}${valueText}"
        ${locked ? "disabled" : ""}
      >
        ${isSpecial
          ? `<span class="special-cell">${escapeHtml(cell.name)}</span>`
          : `<img src="${escapeHtml(cell.imageUrl)}" alt="${escapeHtml(cell.name)}" loading="lazy" />`}
        <span class="cell-name">${escapeHtml(cell.name)}</span>
        <span class="cell-badge">${categoryLabel(cell.type)}</span>
      </button>
    `;
  }).join("");
}

function renderStatus() {
  const spec = getSpec();
  const baseDone = state.base < 0;
  const ready = state.lineReached && baseDone;

  els.currentSpecText.textContent = spec.name;
  els.longestLine.textContent = state.longestLine;
  els.markedCount.textContent = state.marked.length;
  els.baseValue.textContent = formatGuarantee(state.base);

  els.lineCondition.textContent = state.lineReached ? `${spec.name}已达成` : `${spec.name}未达成`;
  els.lineCondition.classList.toggle("done", state.lineReached);
  els.baseCondition.textContent = baseDone ? "保底已达成" : "保底未达成";
  els.baseCondition.classList.toggle("done", baseDone);

  let status = "进行中";
  if (state.settled) status = "已结单";
  else if (ready) status = "可结单";
  else if (state.lineReached) status = "待保底";
  else if (baseDone) status = "待连线";
  els.statusPill.textContent = status;
  els.statusPill.classList.toggle("ready", ready && !state.settled);
  els.statusPill.classList.toggle("finished", state.settled);

  els.boardStatus.textContent = state.settled
    ? "本局已结单"
    : state.lineReached
      ? "连线已达成，棋盘已锁定"
      : `点击格子点亮，目标${spec.name}`;

  els.bombBtn.disabled = state.settled;
  els.withdrawBtn.disabled = state.settled;
  els.withdrawInput.disabled = state.settled;
  els.undoBtn.disabled = state.settled || state.lineReached || state.history.length === 0;
  els.settleBtn.disabled = state.settled || !ready;
  els.settleBtn.textContent = state.settled ? "本局已结单" : ready ? "正式结单" : "条件未达成";
}

function update({ save = true } = {}) {
  renderSpecs();
  renderBoard();
  renderStatus();
  renderLog();
  if (save) scheduleSave();
}

function pushHistory(action) {
  state.history.push(action);
  state.history = state.history.slice(-100);
}

function serializableState() {
  return {
    version: 1,
    spec: state.spec,
    initialBase: state.initialBase,
    base: state.base,
    board: state.board,
    marked: state.marked,
    longestLine: state.longestLine,
    completedLine: state.completedLine,
    lineReached: state.lineReached,
    settled: state.settled,
    history: state.history,
    logEntries: state.logEntries
  };
}

function applyRemoteState(nextState) {
  const spec = getSpec(nextState.spec);
  state.spec = spec.target;
  state.initialBase = Number.isFinite(Number(nextState.initialBase))
    ? Number(nextState.initialBase)
    : spec.guarantee;
  state.base = Number.isFinite(Number(nextState.base)) ? Number(nextState.base) : state.initialBase;
  state.board = Array.isArray(nextState.board) && nextState.board.length === 100
    ? nextState.board
    : generateBoard();
  state.marked = Array.isArray(nextState.marked)
    ? nextState.marked.filter((index) => Number.isInteger(index) && index >= 0 && index < 100)
    : [];
  state.completedLine = Array.isArray(nextState.completedLine) ? nextState.completedLine : [];
  state.lineReached = Boolean(nextState.lineReached);
  state.settled = Boolean(nextState.settled);
  state.history = Array.isArray(nextState.history) ? nextState.history : [];
  state.logEntries = Array.isArray(nextState.logEntries) ? nextState.logEntries : [];
  updateLineState({ allowLock: false });
}

function initializeRound({ keepSpec = true } = {}) {
  const spec = keepSpec ? getSpec() : SPEC_OPTIONS[0];
  state.spec = spec.target;
  state.initialBase = spec.guarantee;
  state.base = spec.guarantee;
  state.board = generateBoard();
  state.marked = [];
  state.longestLine = 0;
  state.completedLine = [];
  state.lineReached = false;
  state.settled = false;
  state.history = [];
  state.logEntries = [];
  els.withdrawInput.value = "";
  els.boardSearchInput.value = "";
  setSearchMessage("");
  addLog(`新一局开始：${spec.name}，基础保底 ${formatGuarantee(spec.guarantee)}W`);
}

async function createSession() {
  if (roomCode) return;
  try {
    const response = await fetch("/api/game-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameSlug: "bingo2-super", state: serializableState() })
    });
    if (!response.ok) throw new Error("session failed");
    const session = await response.json();
    sessionId = session.id;
    els.saveStatus.textContent = "已连接数据库";
  } catch (_) {
    els.saveStatus.textContent = "本地运行";
  }
}

function scheduleSave() {
  if (isApplyingRemote) return;
  clearTimeout(saveTimer);
  if (roomCode) {
    els.saveStatus.textContent = "房间同步中...";
    els.roomSyncText.textContent = "同步中...";
    saveTimer = setTimeout(saveRoom, 220);
    return;
  }
  if (!sessionId) return;
  els.saveStatus.textContent = "保存中...";
  saveTimer = setTimeout(saveSession, 250);
}

async function loadRoom() {
  if (!roomCode) return false;
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, {
      headers: { Accept: "application/json" }
    });
    const room = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(room.error || "房间不存在");
    roomCode = room.code;
    roomRevision = room.revision;
    els.roomBar.hidden = false;
    els.roomCodeText.textContent = room.code;
    els.roomSyncText.textContent = "已连接";
    els.saveStatus.textContent = "房间已连接";
    document.title = `${room.gameName} · ${room.code}`;

    if (room.state && Array.isArray(room.state.board) && room.state.board.length === 100) {
      applyRemoteState(room.state);
    } else {
      initializeRound();
      await saveRoom("初始化 BINGO 2.0 超级版", "room_init");
    }
    setInterval(pollRoom, 1500);
    return true;
  } catch (error) {
    els.saveStatus.textContent = "房间连接失败";
    els.roomSyncText.textContent = error.message;
    setMessage(`房间连接失败：${error.message}`);
    return false;
  }
}

async function pollRoom() {
  if (!roomCode) return;
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return;
    const room = await response.json();
    if (room.revision <= roomRevision) {
      els.roomSyncText.textContent = "已同步";
      return;
    }
    roomRevision = room.revision;
    isApplyingRemote = true;
    applyRemoteState(room.state || {});
    update({ save: false });
    isApplyingRemote = false;
    els.roomSyncText.textContent = "收到更新";
  } catch (_) {
    els.roomSyncText.textContent = "同步失败";
  }
}

async function saveRoom(message = "", eventType = "state_update") {
  if (!roomCode) return;
  const messages = pendingRoomMessages.splice(0);
  const finalMessage = message || messages.join("；") || "更新 BINGO 房间数据";
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: serializableState(),
        eventType,
        actor: "房间玩家",
        message: finalMessage,
        payload: { logs: messages }
      })
    });
    if (!response.ok) throw new Error("save room failed");
    const room = await response.json();
    roomRevision = room.revision;
    els.saveStatus.textContent = "房间已保存";
    els.roomSyncText.textContent = "已同步";
  } catch (_) {
    els.saveStatus.textContent = "房间保存失败";
    els.roomSyncText.textContent = "保存失败";
  }
}

async function saveSession() {
  if (!sessionId) return;
  try {
    await fetch(`/api/game-sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: serializableState() })
    });
    els.saveStatus.textContent = "已保存";
  } catch (_) {
    els.saveStatus.textContent = "保存失败";
  }
}

els.specGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-spec]");
  if (!button || hasStarted()) return;
  const previous = {
    spec: state.spec,
    initialBase: state.initialBase,
    base: state.base
  };
  const spec = getSpec(button.dataset.spec);
  if (spec.target === state.spec) return;
  pushHistory({ type: "spec", previous });
  state.spec = spec.target;
  state.initialBase = spec.guarantee;
  state.base = spec.guarantee;
  addLog(`切换规格：${spec.name}，基础保底 ${formatGuarantee(spec.guarantee)}W`);
  setMessage(`已选择${spec.name}。`);
  update();
});

els.bingoBoard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cell-index]");
  if (!button || state.lineReached || state.settled) return;
  const index = Number(button.dataset.cellIndex);
  const wasMarked = state.marked.includes(index);
  const cell = state.board[index];
  pushHistory({ type: "cell", index, wasMarked });
  state.marked = wasMarked
    ? state.marked.filter((item) => item !== index)
    : [...state.marked, index];
  addLog(`${wasMarked ? "取消" : "点亮"}第 ${Math.floor(index / 10) + 1} 行第 ${(index % 10) + 1} 格：${cell.name}`);
  updateLineState();
  if (!state.lineReached) {
    setMessage(`${wasMarked ? "已取消" : "已点亮"}“${cell.name}”，当前最长连续 ${state.longestLine} 格。`);
  }
  update();
});

els.boardSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearSearchHighlight();
  const query = els.boardSearchInput.value.trim();
  if (!query) {
    setSearchMessage("请输入要查找的物品名称。", true);
    els.boardSearchInput.focus();
    return;
  }

  const matches = findSearchMatches(query);
  if (!matches.length) {
    setSearchMessage(`棋盘中没有找到“${query}”。`, true);
    return;
  }

  const marked = new Set(state.marked);
  const available = matches.find((index) => !marked.has(index));
  if (available === undefined) {
    setSearchMessage(`“${state.board[matches[0]].name}”的格子已经全部点亮。`, true);
    return;
  }

  const cell = state.board[available];
  const remaining = matches.filter((index) => !marked.has(index)).length;
  setSearchMessage(`已定位“${cell.name}”，还有 ${remaining} 个未点亮格子。`);
  highlightSearchTarget(available);
});

els.bombBtn.addEventListener("click", () => {
  if (state.settled) return;
  pushHistory({ type: "base", previousBase: state.base });
  state.base += 60;
  addLog("炸单：基础保底 +60W");
  setMessage("炸单成功，基础保底增加 60W。");
  update();
});

els.withdrawBtn.addEventListener("click", () => {
  if (state.settled) return;
  const amount = readAmount();
  if (amount === null) {
    setMessage("请输入大于 0 的撤离成功金额。");
    return;
  }
  pushHistory({ type: "base", previousBase: state.base });
  state.base -= amount;
  els.withdrawInput.value = "";
  addLog(`撤离成功：基础保底 -${amount}W`);
  setMessage(state.base < 0 ? "基础保底已经小于 0，保底条件达成。" : `撤离成功，基础保底扣除 ${amount}W。`);
  update();
});

els.withdrawInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") els.withdrawBtn.click();
});

els.undoBtn.addEventListener("click", () => {
  if (state.settled || state.lineReached || !state.history.length) return;
  const action = state.history.pop();
  if (action.type === "cell") {
    state.marked = action.wasMarked
      ? [...new Set([...state.marked, action.index])]
      : state.marked.filter((item) => item !== action.index);
  } else if (action.type === "base") {
    state.base = action.previousBase;
  } else if (action.type === "spec") {
    state.spec = action.previous.spec;
    state.initialBase = action.previous.initialBase;
    state.base = action.previous.base;
  }
  updateLineState({ allowLock: false });
  state.completedLine = [];
  addLog("撤回上一步操作");
  setMessage("已撤回房间内最后一次操作。");
  update();
});

function clearConfirmation(button, text) {
  clearTimeout(confirmTimer);
  button.dataset.confirming = "";
  button.textContent = text;
}

els.resetBtn.addEventListener("click", () => {
  if (els.resetBtn.dataset.confirming !== "1") {
    els.resetBtn.dataset.confirming = "1";
    els.resetBtn.textContent = "再次点击确认重开";
    setMessage("重开会重新随机100格并清空本局进度，请再次点击确认。");
    confirmTimer = setTimeout(() => clearConfirmation(els.resetBtn, "重开一局"), 4500);
    return;
  }
  clearConfirmation(els.resetBtn, "重开一局");
  initializeRound();
  setMessage("已重新随机棋盘，新一局开始。");
  update();
});

els.settleBtn.addEventListener("click", () => {
  if (state.settled || !state.lineReached || state.base >= 0) return;
  if (els.settleBtn.dataset.confirming !== "1") {
    els.settleBtn.dataset.confirming = "1";
    els.settleBtn.textContent = "再次点击确认结单";
    setMessage("结单后本局将锁定，请再次点击确认。");
    confirmTimer = setTimeout(() => clearConfirmation(els.settleBtn, "正式结单"), 4500);
    return;
  }
  clearConfirmation(els.settleBtn, "正式结单");
  state.settled = true;
  addLog(`正式结单：${getSpec().name}和基础保底条件均已达成`);
  setMessage("本局已正式结单。");
  update();
});

const response = await fetch("../content/bingo2-items.json");
const data = await response.json();
itemData = data.items || [];
if (!itemData.length) throw new Error("BINGO 2.0 物品资料加载失败");

const roomLoaded = await loadRoom();
if (roomLoaded) {
  isApplyingRemote = true;
  update({ save: false });
  isApplyingRemote = false;
} else {
  initializeRound();
  await createSession();
  update();
}
