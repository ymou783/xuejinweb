const INITIAL_BASE = 4888;

const state = {
  base: INITIAL_BASE,
  left: 0,
  right: 0,
  entries: [],
  nextEntryId: 1,
  settled: false,
  logEntries: []
};

let sessionId = null;
let roomCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || "";
let roomRevision = -1;
let saveTimer = null;
let isApplyingRemote = false;
let pendingRoomMessages = [];

const els = {
  baseValue: document.querySelector("#baseValue"),
  leftValue: document.querySelector("#leftValue"),
  rightValue: document.querySelector("#rightValue"),
  bombBtn: document.querySelector("#bombBtn"),
  withdrawInput: document.querySelector("#withdrawInput"),
  withdrawBtn: document.querySelector("#withdrawBtn"),
  scaleInput: document.querySelector("#scaleInput"),
  scaleBtn: document.querySelector("#scaleBtn"),
  undoScaleBtn: document.querySelector("#undoScaleBtn"),
  clearScaleBtn: document.querySelector("#clearScaleBtn"),
  entriesList: document.querySelector("#entriesList"),
  baseMessage: document.querySelector("#baseMessage"),
  scaleMessage: document.querySelector("#scaleMessage"),
  scale: document.querySelector("#scale"),
  log: document.querySelector("#log"),
  resetBtn: document.querySelector("#resetBtn"),
  manualSettleBtn: document.querySelector("#manualSettleBtn"),
  statusPill: document.querySelector("#statusPill"),
  saveStatus: document.querySelector("#saveStatus"),
  roomBar: document.querySelector("#roomBar"),
  roomCodeText: document.querySelector("#roomCodeText"),
  roomSyncText: document.querySelector("#roomSyncText")
};

function readAmount(input) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function addLog(text) {
  state.logEntries.unshift({
    text,
    time: new Date().toLocaleString("zh-CN", { hour12: false })
  });
  state.logEntries = state.logEntries.slice(0, 120);
  pendingRoomMessages.push(text);
  renderLog();
}

function renderLog() {
  els.log.innerHTML = (state.logEntries || []).map((item) => `<p>${item.time ? `${escapeHtml(item.time)} · ` : ""}${escapeHtml(item.text)}</p>`).join("");
}

function setMessage(target, text, isEnd = false) {
  target.textContent = text;
  target.classList.toggle("end", isEnd);
}

function recalculateScale() {
  state.left = state.entries.filter((entry) => entry.side === "left").reduce((sum, entry) => sum + entry.amount, 0);
  state.right = state.entries.filter((entry) => entry.side === "right").reduce((sum, entry) => sum + entry.amount, 0);
}

function getConditions() {
  const diff = Math.abs(state.left - state.right);
  return {
    baseDone: state.base < 0,
    scaleDone: state.left > 0 && state.right > 0 && diff < 50,
    diff
  };
}

function renderEntries() {
  if (!state.entries.length) {
    els.entriesList.innerHTML = '<div class="empty-entry">暂无天平记录，放入后可在这里删除或撤回。</div>';
    return;
  }
  els.entriesList.innerHTML = state.entries.map((entry, index) => `
    <div class="entry">
      <div>
        <strong>${entry.side === "left" ? "左侧" : "右侧"} ${entry.amount}W</strong>
        <span>第 ${index + 1} 次放入</span>
      </div>
      <button type="button" data-remove-entry="${entry.id}" ${state.settled ? "disabled" : ""}>删除</button>
    </div>
  `).join("");
}

function update() {
  recalculateScale();
  els.baseValue.textContent = state.base;
  els.leftValue.textContent = state.left;
  els.rightValue.textContent = state.right;

  const diff = state.right - state.left;
  const tilt = Math.max(-10, Math.min(10, diff / 20));
  els.scale.style.setProperty("--tilt", `${tilt}deg`);
  els.scale.style.setProperty("--left-pan", `${Math.max(-16, Math.min(16, -diff / 24))}px`);
  els.scale.style.setProperty("--right-pan", `${Math.max(-16, Math.min(16, diff / 24))}px`);

  const conditions = getConditions();
  let status = "进行中";
  if (state.settled) status = "已结单";
  else if (conditions.baseDone && !conditions.scaleDone) status = "待天平";
  else if (conditions.scaleDone && !conditions.baseDone) status = "待保底";
  els.statusPill.textContent = status;
  els.statusPill.classList.toggle("finished", state.settled);

  [els.bombBtn, els.withdrawBtn, els.withdrawInput, els.scaleBtn, els.scaleInput].forEach((el) => {
    el.disabled = state.settled;
  });
  els.undoScaleBtn.disabled = state.settled || state.entries.length === 0;
  els.clearScaleBtn.disabled = state.settled || state.entries.length === 0;
  els.manualSettleBtn.disabled = state.settled;
  renderEntries();
  scheduleSave();
}

function settleGame(reason) {
  if (state.settled) return;
  state.settled = true;
  setMessage(els.scaleMessage, reason, true);
  setMessage(els.baseMessage, reason, true);
  addLog(`结单：${reason}`);
  update();
}

function trySettle() {
  const conditions = getConditions();
  if (state.settled || !conditions.baseDone || !conditions.scaleDone) return;
  const reason = "天平条件和基础保底条件都已达成，结单。";
  settleGame(reason);
}

function checkBaseCondition() {
  const conditions = getConditions();
  if (!conditions.baseDone) {
    setMessage(els.baseMessage, "基础保底仍未小于 0，保底条件未达成。");
    return;
  }
  const msg = conditions.scaleDone
    ? "基础保底小于 0，保底条件达成。"
    : "基础保底小于 0，保底条件达成，等待天平条件。";
  setMessage(els.baseMessage, msg, conditions.scaleDone);
  addLog("保底条件当前达成：基础保底小于 0");
  trySettle();
}

function checkScaleCondition() {
  const conditions = getConditions();
  if (conditions.scaleDone) {
    const msg = conditions.baseDone
      ? `天平两侧差值 ${conditions.diff}W，小于 50W，天平条件达成。`
      : `天平两侧差值 ${conditions.diff}W，小于 50W，天平条件达成，等待基础保底小于 0。`;
    setMessage(els.scaleMessage, msg, conditions.baseDone);
    addLog(`天平条件当前达成：两侧差值 ${conditions.diff}W`);
    trySettle();
    return;
  }
  setMessage(els.scaleMessage, `当前两侧差值 ${conditions.diff}W，天平条件未达成。`);
}

function serializableState() {
  return {
    base: state.base,
    left: state.left,
    right: state.right,
    entries: state.entries,
    nextEntryId: state.nextEntryId,
    settled: state.settled,
    logEntries: state.logEntries || []
  };
}

function applyRemoteState(nextState) {
  state.base = Number.isFinite(Number(nextState.base)) ? Number(nextState.base) : INITIAL_BASE;
  state.left = Number.isFinite(Number(nextState.left)) ? Number(nextState.left) : 0;
  state.right = Number.isFinite(Number(nextState.right)) ? Number(nextState.right) : 0;
  state.entries = Array.isArray(nextState.entries) ? nextState.entries : [];
  state.nextEntryId = Number.isFinite(Number(nextState.nextEntryId)) ? Number(nextState.nextEntryId) : 1;
  state.settled = Boolean(nextState.settled);
  state.logEntries = Array.isArray(nextState.logEntries) ? nextState.logEntries : [];
  renderLog();
}

async function createSession() {
  if (roomCode) return;
  try {
    const response = await fetch("/api/game-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameSlug: "mo-hong-tianping", state: serializableState() })
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
  if (roomCode) {
    clearTimeout(saveTimer);
    els.saveStatus.textContent = "房间同步中...";
    if (els.roomSyncText) els.roomSyncText.textContent = "同步中...";
    saveTimer = setTimeout(saveRoom, 220);
    return;
  }
  if (!sessionId) return;
  clearTimeout(saveTimer);
  els.saveStatus.textContent = "保存中...";
  saveTimer = setTimeout(saveSession, 250);
}

async function loadRoom() {
  if (!roomCode) return false;
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { headers: { Accept: "application/json" } });
    const room = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(room.error || "房间不存在");
    roomCode = room.code;
    roomRevision = room.revision;
    els.roomBar.hidden = false;
    els.roomCodeText.textContent = room.code;
    els.saveStatus.textContent = "房间已连接";
    els.roomSyncText.textContent = "已连接";
    document.title = `${room.gameName} · ${room.code}`;
    if (room.state && typeof room.state.base === "number") {
      applyRemoteState(room.state);
    } else {
      addLog(`房间 ${room.code} 开始：基础保底 4888W`);
      await saveRoom("初始化房间游戏", "room_init");
    }
    setInterval(pollRoom, 1500);
    return true;
  } catch (error) {
    els.saveStatus.textContent = "房间连接失败";
    if (els.roomSyncText) els.roomSyncText.textContent = error.message;
    addLog(`房间连接失败：${error.message}`);
    return false;
  }
}

async function pollRoom() {
  if (!roomCode) return;
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const room = await response.json();
    if (room.revision <= roomRevision) {
      if (els.roomSyncText) els.roomSyncText.textContent = "已同步";
      return;
    }
    roomRevision = room.revision;
    isApplyingRemote = true;
    applyRemoteState(room.state || {});
    update();
    isApplyingRemote = false;
    if (els.roomSyncText) els.roomSyncText.textContent = "收到更新";
  } catch (_) {
    if (els.roomSyncText) els.roomSyncText.textContent = "同步失败";
  }
}

async function saveRoom(message = "", eventType = "state_update") {
  if (!roomCode) return;
  const messages = pendingRoomMessages.splice(0);
  const finalMessage = message || messages.join("；") || "更新房间数据";
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
    if (els.roomSyncText) els.roomSyncText.textContent = "已同步";
  } catch (_) {
    els.saveStatus.textContent = "房间保存失败";
    if (els.roomSyncText) els.roomSyncText.textContent = "保存失败";
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

els.bombBtn.addEventListener("click", () => {
  if (state.settled) return;
  state.base += 60;
  setMessage(els.baseMessage, "炸单成功，基础保底 +60W。");
  addLog("炸单：基础保底 +60W");
  update();
});

els.withdrawBtn.addEventListener("click", () => {
  if (state.settled) return;
  const amount = readAmount(els.withdrawInput);
  if (amount === null) {
    setMessage(els.baseMessage, "请输入大于 0 的撤离成功金额。");
    return;
  }
  state.base -= amount;
  els.withdrawInput.value = "";
  setMessage(els.baseMessage, `撤离成功，基础保底 -${amount}W。`);
  addLog(`撤离成功：基础保底 -${amount}W`);
  update();
  checkBaseCondition();
  update();
});

els.scaleBtn.addEventListener("click", () => {
  if (state.settled) return;
  const amount = readAmount(els.scaleInput);
  if (amount === null) {
    setMessage(els.scaleMessage, "请输入大于 0 的物资价值。");
    return;
  }
  const side = amount < 100 ? "left" : "right";
  state.entries.push({ id: state.nextEntryId++, amount, side });
  setMessage(els.scaleMessage, `${amount}W 放入${side === "left" ? "左侧" : "右侧"}。`);
  addLog(`天平：${amount}W 放入${side === "left" ? "左侧" : "右侧"}`);
  els.scaleInput.value = "";
  update();
  checkScaleCondition();
  update();
});

els.entriesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-entry]");
  if (!button || state.settled) return;
  const id = Number(button.dataset.removeEntry);
  const entry = state.entries.find((item) => item.id === id);
  state.entries = state.entries.filter((item) => item.id !== id);
  addLog(`调整天平：删除 ${entry.side === "left" ? "左侧" : "右侧"} ${entry.amount}W`);
  update();
  checkScaleCondition();
  update();
});

els.undoScaleBtn.addEventListener("click", () => {
  if (state.settled || !state.entries.length) return;
  const entry = state.entries.pop();
  addLog(`调整天平：撤回 ${entry.side === "left" ? "左侧" : "右侧"} ${entry.amount}W`);
  update();
  checkScaleCondition();
  update();
});

els.clearScaleBtn.addEventListener("click", () => {
  if (state.settled || !state.entries.length) return;
  state.entries = [];
  addLog("调整天平：清空天平记录");
  setMessage(els.scaleMessage, "天平记录已清空。");
  update();
});

els.manualSettleBtn.addEventListener("click", () => {
  settleGame("后台或房间玩家手动点击结单。");
});

els.resetBtn.addEventListener("click", () => {
  state.base = INITIAL_BASE;
  state.left = 0;
  state.right = 0;
  state.entries = [];
  state.nextEntryId = 1;
  state.settled = false;
  els.withdrawInput.value = "";
  els.scaleInput.value = "";
  els.log.innerHTML = "";
  setMessage(els.baseMessage, "");
  setMessage(els.scaleMessage, "");
  addLog("新一局开始：基础保底 4888W");
  update();
});

[els.withdrawInput, els.scaleInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (input === els.withdrawInput) els.withdrawBtn.click();
    if (input === els.scaleInput) els.scaleBtn.click();
  });
});

const roomLoaded = await loadRoom();
if (roomLoaded) {
  isApplyingRemote = true;
  update();
  isApplyingRemote = false;
} else {
  await createSession();
  addLog("新一局开始：基础保底 4888W");
  update();
}
