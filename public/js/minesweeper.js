const SPECS = [
  { size: 4, mines: 4, price: 888, base: 2288 },
  { size: 6, mines: 12, price: 2888, base: 8888 },
  { size: 8, mines: 26, price: 4888, base: 15888 }
];

const FOUR_BY_FOUR_LOADOUT = {
  normal: 4,
  sunflower: 2,
  yinYang: 2,
  pea: 1,
  wogua: 3,
  potato: 1,
  pepper: 2,
  burst: 1
};

const SPECIAL_LOADOUT_WEIGHTS = {
  sunflower: 2,
  yinYang: 2,
  pea: 1,
  wogua: 3,
  potato: 1,
  pepper: 2,
  burst: 1
};

const MINE_TYPES = [
  { key: "normal", name: "普通雷", asset: "normal", limit: "board", summary: "基础预埋雷", detail: "普通地雷，找到全部普通雷后结束挖雷阶段。", effect: "翻到：找到 1 颗普通雷" },
  { key: "wogua", name: "窝瓜雷", asset: "wogua", limit: 3, summary: "任务判定雷", task: "下一局打手击杀总和 > 6 人", detail: "翻到后确认“打手击杀总和 > 6 人”是否完成。成功不扣额外次数，失败扣 1 次挖雷。", effect: "翻到：选择任务成功或失败" },
  { key: "yinYang", name: "阴阳向日葵", asset: "yin-yang", limit: 2, summary: "保底增益雷", detail: "翻到后立即增加当前基础保底 500W，是本局高价值保底增益。", effect: "触发后保底增加 500W" },
  { key: "potato", name: "土豆雷", asset: "potato", limit: 2, summary: "任务判定雷", task: "下一局必须处理伏天队", detail: "翻到后确认“处理伏天队”是否完成。成功不扣额外次数，失败扣 1 次挖雷。", effect: "翻到：选择任务成功或失败" },
  { key: "sunflower", name: "向日葵", asset: "sunflower", limit: 2, summary: "保底增益雷", detail: "翻到后立即增加当前基础保底 200W，适合用来抬高本局保底。", effect: "触发后保底增加 200W" },
  { key: "pea", name: "排雷豌豆", asset: "pea-sweeper", limit: 2, summary: "自动排雷雷", detail: "翻到后自动翻开 1 个尚未翻开的普通雷，不额外消耗挖雷次数。", effect: "触发后自动翻开一个普通雷" },
  { key: "pepper", name: "辣椒雷", asset: "pepper", limit: 1, summary: "任务判定雷", task: "下一局完成卡面指定的武器条件", detail: "翻到后确认卡面任务是否完成。成功不扣额外次数，失败扣 1 次挖雷。", effect: "翻到：选择任务成功或失败" },
  { key: "burst", name: "爆裂菜问", asset: "burst-cabbage", limit: 1, summary: "变形替换雷", detail: "翻到后从尚未翻开的普通雷中随机挑选 1 个，替换为辣椒雷。", effect: "触发后随机将 1 个普通雷替换为辣椒雷" }
];

const LOOT_OPTIONS = [
  { key: "small_red", label: "六格及以内小红", detail: "带出 +1 次", digs: 1 },
  { key: "big_red", label: "八格及以上大红", detail: "带出 +2 次", digs: 2 },
  { key: "heart", label: "非洲之心 / 海洋之泪", detail: "带出 +3 次", digs: 3 },
  { key: "revive", label: "复苏呼吸机", detail: "带出 +3 次", digs: 3 }
];

const STORAGE_KEY = "xuejin-minesweeper-deploy-v5";
let roomCode = new URLSearchParams(location.search).get("room")?.trim().toUpperCase() || "";
let roomRevision = -1;
let sessionId = "";
let saveTimer = null;
let pollTimer = null;
let isApplyingRemote = false;
let swapSource = null;
let dragSource = null;

const state = {
  version: 5,
  game: "minesweeper-battle",
  spec: 0,
  phase: "setup",
  selectedMine: "normal",
  mines: [],
  opened: [],
  pendingTask: null,
  digs: 0,
  base: SPECS[0].base,
  lootSelections: [],
  settled: false,
  events: [],
  history: []
};

const els = {
  missionText: document.querySelector("#missionText"),
  specList: document.querySelector("#specList"),
  mineTypeList: document.querySelector("#mineTypeList"),
  mineLegend: document.querySelector("#mineLegend"),
  phaseText: document.querySelector("#phaseText"),
  deployedCount: document.querySelector("#deployedCount"),
  mineTarget: document.querySelector("#mineTarget"),
  specialDeployedCount: document.querySelector("#specialDeployedCount"),
  specialTarget: document.querySelector("#specialTarget"),
  foundCount: document.querySelector("#foundCount"),
  foundTarget: document.querySelector("#foundTarget"),
  digCount: document.querySelector("#digCount"),
  boardKicker: document.querySelector("#boardKicker"),
  boardTitle: document.querySelector("#boardTitle"),
  boardHint: document.querySelector("#boardHint"),
  mineBoard: document.querySelector("#mineBoard"),
  boardFrame: document.querySelector("#boardFrame"),
  columnLabels: document.querySelector("#columnLabels"),
  rowLabels: document.querySelector("#rowLabels"),
  lockMapBtn: document.querySelector("#lockMapBtn"),
  redeployBtn: document.querySelector("#redeployBtn"),
  settleBtn: document.querySelector("#settleBtn"),
  gameMessage: document.querySelector("#gameMessage"),
  pendingTaskBtn: document.querySelector("#pendingTaskBtn"),
  baseValue: document.querySelector("#baseValue"),
  calculatorForm: document.querySelector("#calculatorForm"),
  withdrawInput: document.querySelector("#withdrawInput"),
  lootOptions: document.querySelector("#lootOptions"),
  selectAllLoot: document.querySelector("#selectAllLoot"),
  selectedLootDigs: document.querySelector("#selectedLootDigs"),
  failBtn: document.querySelector("#failBtn"),
  previewDigs: document.querySelector("#previewDigs"),
  capLeft: document.querySelector("#capLeft"),
  formulaText: document.querySelector("#formulaText"),
  mineCondition: document.querySelector("#mineCondition"),
  baseCondition: document.querySelector("#baseCondition"),
  eventLog: document.querySelector("#eventLog"),
  undoBtn: document.querySelector("#undoBtn"),
  saveStatus: document.querySelector("#saveStatus"),
  roomBar: document.querySelector("#roomBar"),
  roomCodeText: document.querySelector("#roomCodeText"),
  roomSyncText: document.querySelector("#roomSyncText"),
  helpBtn: document.querySelector("#helpBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  dialogBackdrop: document.querySelector("#dialogBackdrop"),
  dialogClose: document.querySelector("#dialogClose"),
  dialogContent: document.querySelector("#dialogContent")
};

function spec() { return SPECS[state.spec] || SPECS[0]; }
function mineType(key) { return MINE_TYPES.find((item) => item.key === key) || MINE_TYPES[0]; }
function isTaskMine(key) { return ["wogua", "potato", "pepper"].includes(key); }
function scaledSpecialLoadout(total) {
  const entries = Object.entries(SPECIAL_LOADOUT_WEIGHTS);
  const weightTotal = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const result = Object.fromEntries(entries.map(([key, weight]) => [key, Math.floor(total * weight / weightTotal)]));
  let remaining = total - Object.values(result).reduce((sum, count) => sum + count, 0);
  entries
    .map(([key, weight], order) => ({ key, order, fraction: total * weight / weightTotal - result[key] }))
    .sort((a, b) => b.fraction - a.fraction || a.order - b.order)
    .forEach((entry) => { if (remaining > 0) { result[entry.key] += 1; remaining -= 1; } });
  return result;
}
function loadoutForSpec(item = spec()) { return item.size === 4 ? { ...FOUR_BY_FOUR_LOADOUT } : { normal: item.mines, ...scaledSpecialLoadout(item.mines) }; }
function loadout() { return loadoutForSpec(spec()); }
function targetCount(key, item = spec()) { return loadoutForSpec(item)[key] || 0; }
function mineAt(index) { return state.mines.find((mine) => mine.index === index) || null; }
function isOpen(index) { return state.opened.includes(index); }
function foundMines() { return state.opened.filter((index) => mineAt(index)).length; }
function normalFoundMines() { return state.opened.filter((index) => { const mine = mineAt(index); return mine && (mine.type === "normal" || mine.normalCredit); }).length; }
function normalTarget() { return targetCount("normal"); }
function specialTarget() { return Object.entries(loadout()).filter(([key]) => key !== "normal").reduce((sum, [, count]) => sum + count, 0); }
function totalMineTarget() { return normalTarget() + specialTarget(); }
function normalCount() { return mineCount("normal"); }
function specialCount() { return state.mines.length - normalCount(); }
function mineDone() { return normalFoundMines() >= normalTarget(); }
function baseDone() { return state.base < 0; }
function cellName(index) { return `${String.fromCharCode(65 + Math.floor(index / spec().size))}${index % spec().size + 1}`; }
function timeLabel() { return new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function amountDigs(amount) { if (amount >= 1500) return 4; if (amount >= 1300) return 3; if (amount >= 1000) return 2; if (amount >= 800) return 1; return 0; }
function selectedLoot() { return LOOT_OPTIONS.filter((item) => state.lootSelections.includes(item.key)); }
function lootDigs() { return selectedLoot().reduce((sum, item) => sum + item.digs, 0); }
function mineCount(key) { return state.mines.filter((mine) => mine.type === key).length; }
function mineLimit(item) { return targetCount(item.key); }
function layoutMatchesTarget() { return state.mines.length === totalMineTarget() && MINE_TYPES.every((item) => mineCount(item.key) === targetCount(item.key)); }

function previewCalculation() {
  const amount = Math.max(0, Number(els.withdrawInput.value) || 0);
  const byAmount = amountDigs(amount);
  const byLoot = lootDigs();
  const awarded = byAmount + byLoot;
  els.previewDigs.textContent = awarded;
  els.capLeft.textContent = state.digs;
  els.selectedLootDigs.textContent = byLoot;
  els.formulaText.textContent = `金额档 ${byAmount} 次 + 已选物资 ${byLoot} 次 = ${awarded} 次；挖雷次数不设下限，允许变成负数。`;
  return { amount, byAmount, byLoot, awarded };
}

function snapshotState() {
  return { spec: state.spec, phase: state.phase, selectedMine: state.selectedMine, mines: state.mines.map((mine) => ({ ...mine })), opened: [...state.opened], pendingTask: state.pendingTask ? { ...state.pendingTask } : null, digs: state.digs, base: state.base, lootSelections: [...state.lootSelections], settled: state.settled, events: state.events.map((item) => ({ ...item })) };
}
function pushHistory() { state.history.push(snapshotState()); state.history = state.history.slice(-60); }
function restoreSnapshot(previous) { Object.assign(state, { spec: previous.spec, phase: previous.phase, selectedMine: previous.selectedMine || "normal", mines: previous.mines.map((mine) => ({ ...mine })), opened: [...previous.opened], pendingTask: previous.pendingTask ? { ...previous.pendingTask } : null, digs: previous.digs, base: previous.base, lootSelections: [...(previous.lootSelections || [])], settled: previous.settled, events: previous.events.map((item) => ({ ...item })) }); }
function addEvent(message, important = false, save = true) { state.events.unshift({ time: timeLabel(), message, important }); state.events = state.events.slice(0, 80); if (save) scheduleSave(message, important ? "important" : "state_update"); }
function setMessage(text, type = "") { els.gameMessage.className = `message ${type}`.trim(); els.gameMessage.textContent = text; }

function miniMinePositions(size, count) {
  const total = size * size;
  const picks = new Set();
  for (let index = 0; index < total && picks.size < count; index += 1) picks.add((index * (total - 1) + size) % total);
  return picks;
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createAutomaticMines(item = spec()) {
  const target = loadoutForSpec(item);
  const types = shuffled(MINE_TYPES.flatMap((mine) => Array.from({ length: target[mine.key] || 0 }, () => mine.key)));
  const positions = shuffled(Array.from({ length: item.size ** 2 }, (_, index) => index)).slice(0, types.length);
  return types.map((type, order) => ({ index: positions[order], type }));
}

function autoDeployBoard() {
  state.mines = createAutomaticMines();
  state.opened = [];
  swapSource = null;
  dragSource = null;
}

function renderSpecs() {
  els.specList.innerHTML = SPECS.map((item, index) => {
    const itemLoadout = loadoutForSpec(item);
    const itemNormal = itemLoadout.normal;
    const itemSpecial = Object.entries(itemLoadout).filter(([key]) => key !== "normal").reduce((sum, [, count]) => sum + count, 0);
    const miniMines = miniMinePositions(item.size, itemNormal + itemSpecial);
    const mini = Array.from({ length: item.size ** 2 }, (_, cell) => `<i class="${miniMines.has(cell) ? "mine" : ""}"></i>`).join("");
    return `<button class="spec-card ${state.spec === index ? "active" : ""}" type="button" data-spec="${index}" ${state.phase !== "setup" ? "disabled" : ""}><span class="spec-preview" style="--mini-size:${item.size}">${mini}</span><span class="spec-copy"><strong><b>${item.size}×${item.size}</b> / 普通${itemNormal}+其他${itemSpecial}</strong><span>${item.price}R</span><small>基础保底 <b>${item.base}W</b></small></span></button>`;
  }).join("");
}

function renderMineTypes() {
  els.mineTypeList.innerHTML = MINE_TYPES.map((item) => {
    const count = mineCount(item.key);
    const target = mineLimit(item);
    return `<article class="mine-type-card fixed-loadout"><i class="mine-icon card-${item.asset}" aria-hidden="true"></i><span class="mine-type-copy"><strong>${item.name}</strong><small>${item.effect}</small></span><span class="mine-stock"><small>固定数量</small><b>${count}/${target}</b></span></article>`;
  }).join("");
}

function renderLegend() {
  els.mineLegend.innerHTML = MINE_TYPES.map((item, index) => `<article class="legend-item"><div class="legend-art"><i class="mine-icon card-${item.asset}" aria-hidden="true"></i><span>0${index + 1}</span></div><div class="legend-copy"><strong>${item.name}</strong><b>${item.summary}</b><p>${item.detail}</p><small>${item.effect}</small></div></article>`).join("");
}

function renderLootOptions() {
  els.lootOptions.innerHTML = LOOT_OPTIONS.map((item) => `<label class="loot-option"><input type="checkbox" name="loot" value="${item.key}" ${state.lootSelections.includes(item.key) ? "checked" : ""} /><span>${item.label}<small>${item.detail}</small></span></label>`).join("");
  els.selectAllLoot.checked = state.lootSelections.length === LOOT_OPTIONS.length;
}

function renderBoard() {
  const item = spec();
  const compact = window.matchMedia("(max-width: 800px)").matches;
  const cellSize = compact
    ? item.size === 4 ? "clamp(64px, 20vw, 112px)" : item.size === 6 ? "clamp(44px, 13vw, 74px)" : "clamp(32px, 9.6vw, 56px)"
    : item.size === 4 ? "clamp(104px, 8.8vw, 126px)" : item.size === 6 ? "clamp(64px, 5.8vw, 84px)" : "clamp(46px, 4.4vw, 64px)";
  els.mineBoard.style.setProperty("--size", item.size);
  els.boardFrame.style.setProperty("--size", item.size);
  els.boardFrame.style.setProperty("--cell", cellSize);
  els.mineBoard.setAttribute("aria-rowcount", item.size);
  els.mineBoard.setAttribute("aria-colcount", item.size);
  els.columnLabels.innerHTML = Array.from({ length: item.size }, (_, index) => `<span>${index + 1}</span>`).join("");
  els.rowLabels.innerHTML = Array.from({ length: item.size }, (_, index) => `<span>${String.fromCharCode(65 + index)}</span>`).join("");
  els.mineBoard.innerHTML = Array.from({ length: item.size ** 2 }, (_, index) => {
    const mine = mineAt(index);
    const open = isOpen(index);
    let className = "mine-cell";
    let content = "";
    let label = `${cellName(index)}，未翻开`;
    if (state.phase === "setup") {
      if (mine) { className += ` deployed${swapSource === index ? " swap-selected" : ""}`; content = `<i class="mine-cell-art card-${mineType(mine.type).asset}" aria-hidden="true"></i><span class="mine-cell-name">${mineType(mine.type).name}</span>`; label = `${cellName(index)}，${mineType(mine.type).name}，可拖动交换位置`; } else className += " covered";
    } else if (open) {
      if (mine) { className += " open mine-found"; content = `<i class="mine-cell-art card-${mineType(mine.type).asset}" aria-hidden="true"></i><span class="mine-cell-name">${mineType(mine.type).name}</span>`; label = `${cellName(index)}，找到${mineType(mine.type).name}`; } else { className += " open safe"; label = `${cellName(index)}，安全格`; }
    } else className += " covered";
    const draggable = state.phase === "setup" && mine ? ' draggable="true"' : "";
    const miningLocked = state.phase === "play" && (mineDone() || state.digs <= 0);
    return `<button class="${className}" type="button" role="gridcell" data-index="${index}" aria-label="${label}" aria-rowindex="${Math.floor(index / item.size) + 1}" aria-colindex="${index % item.size + 1}"${draggable} ${(state.settled || miningLocked) ? "disabled" : ""}>${content}</button>`;
  }).join("");
}

function renderStatus() {
  const item = spec();
  const found = normalFoundMines();
  els.missionText.textContent = state.settled ? "本局已结单" : state.phase === "setup" ? `${totalMineTarget()} 个雷已自动部署，拖动调整位置` : mineDone() ? "普通雷已找齐，挖雷结束" : "地图已锁定，按结果翻开格子";
  els.phaseText.textContent = state.settled ? "已结单" : state.phase === "setup" ? "调整布局" : mineDone() ? "挖雷结束" : "翻开格子";
  els.deployedCount.textContent = normalCount();
  els.mineTarget.textContent = normalTarget();
  els.specialDeployedCount.textContent = specialCount();
  els.specialTarget.textContent = specialTarget();
  els.foundCount.textContent = found;
  els.foundTarget.textContent = normalTarget();
  els.digCount.textContent = state.digs;
  els.boardKicker.textContent = `${item.size}×${item.size} / ${totalMineTarget()} 雷`;
  els.boardTitle.textContent = state.phase === "setup" ? "部署雷区" : mineDone() ? "普通雷已找齐" : "翻开格子找雷";
  els.boardHint.textContent = state.phase === "setup" ? "地雷已自动部署；拖动任意两格交换位置，也可以依次点击两格完成交换。" : mineDone() ? "4 颗普通雷已全部找到，挖雷部分结束；可继续记录撤离结果。" : "每翻一个格子消耗 1 次；挖雷次数为 0 或负数时不能继续翻格。";
  els.baseValue.textContent = Math.round(state.base).toLocaleString("zh-CN");
  if (state.pendingTask) {
    const taskItem = mineType(state.pendingTask.mineType);
    els.pendingTaskBtn.hidden = false;
    els.pendingTaskBtn.textContent = `待下一局判定：${taskItem.name} · 点击打开成功/失败判定`;
  } else {
    els.pendingTaskBtn.hidden = true;
    els.pendingTaskBtn.textContent = "";
  }
  const layoutReady = layoutMatchesTarget();
  els.lockMapBtn.hidden = state.phase !== "setup";
  els.lockMapBtn.disabled = !layoutReady;
  els.lockMapBtn.textContent = layoutReady ? "确认布局并开始翻格" : "自动部署数量异常";
  els.redeployBtn.textContent = state.phase === "setup" ? "重新随机部署" : "重新部署";
  const ready = mineDone() && baseDone() && !state.settled;
  els.settleBtn.disabled = !ready;
  els.settleBtn.textContent = state.settled ? "本局已结单" : ready ? "正式结单" : "结单条件未达成";
  els.mineCondition.textContent = mineDone() ? "普通雷已找齐" : `普通雷未达成 ${found}/${normalTarget()}`;
  els.baseCondition.textContent = baseDone() ? "保底已达成" : `保底未达成 ${state.base}W`;
  els.mineCondition.classList.toggle("done", mineDone());
  els.baseCondition.classList.toggle("done", baseDone());
  els.calculatorForm.querySelectorAll("input, button").forEach((control) => { control.disabled = state.phase !== "play" || state.settled; });
  els.undoBtn.disabled = state.history.length === 0 || state.settled;
  previewCalculation();
}

function renderEvents() { els.eventLog.innerHTML = state.events.length ? state.events.map((entry) => `<li><time>${entry.time}</time><span class="${entry.important ? "important" : ""}">${escapeHtml(entry.message)}</span></li>`).join("") : "<li><time>--:--:--</time><span>等待开始</span></li>"; }
function renderAll() { renderSpecs(); renderMineTypes(); renderLegend(); renderLootOptions(); renderBoard(); renderStatus(); renderEvents(); }

function chooseSpec(index) {
  if (state.phase !== "setup" || index === state.spec || !SPECS[index]) return;
  pushHistory(); state.spec = index; state.base = spec().base; state.opened = []; state.digs = 0; state.selectedMine = "normal"; autoDeployBoard();
  addEvent(`选择规格：${spec().size}×${spec().size} / 普通${normalTarget()}+特殊${specialTarget()}`, true, false);
  setMessage(`已自动部署 ${totalMineTarget()} 个雷，可拖动交换位置。`, "success"); renderAll(); scheduleSave("切换扫雷规格并自动部署", "spec_change");
}

function swapMinePositions(sourceIndex, targetIndex, method = "拖动") {
  if (state.phase !== "setup" || sourceIndex === targetIndex) { swapSource = null; renderBoard(); return; }
  const sourceMine = mineAt(sourceIndex);
  const targetMine = mineAt(targetIndex);
  if (!sourceMine) return;
  pushHistory();
  const sourceName = mineType(sourceMine.type).name;
  if (targetMine) {
    const targetName = mineType(targetMine.type).name;
    [sourceMine.type, targetMine.type] = [targetMine.type, sourceMine.type];
    setMessage(`${method}完成：${cellName(sourceIndex)} 的${sourceName}与 ${cellName(targetIndex)} 的${targetName}已交换。`, "success");
  } else {
    sourceMine.index = targetIndex;
    setMessage(`${method}完成：${sourceName}已移动到 ${cellName(targetIndex)}。`, "success");
  }
  swapSource = null;
  dragSource = null;
  addEvent(`${method}调整布局：${cellName(sourceIndex)} → ${cellName(targetIndex)}`, false, false);
  renderAll();
  scheduleSave("调整自动部署布局", "mine_swap");
}

function selectOrSwapMine(index) {
  if (state.phase !== "setup" || state.settled) return;
  if (swapSource === null) {
    if (!mineAt(index)) return;
    swapSource = index;
    setMessage(`已选择 ${cellName(index)} 的${mineType(mineAt(index).type).name}，再点击目标格即可交换。`);
    renderBoard();
    return;
  }
  if (swapSource === index) {
    swapSource = null;
    setMessage("已取消位置调整。");
    renderBoard();
    return;
  }
  swapMinePositions(swapSource, index, "点击");
}

function lockMap() {
  if (state.phase !== "setup" || !layoutMatchesTarget()) return;
  pushHistory(); state.phase = "play"; state.opened = []; state.digs = 0;
  addEvent(`地图已保存：普通${normalCount()} + 特殊${specialCount()}，进入翻格阶段`, true, false); setMessage("地图已隐藏。记录撤离结果后，点击格子开始挖雷。", "success"); renderAll(); scheduleSave("保存地图并进入翻格阶段", "map_lock");
}

function revealBonusCell(index, sameColumn = false) {
  const size = spec().size; const candidates = [];
  for (let step = 1; step < size; step += 1) { const candidate = sameColumn ? index + step * size : index + step; if (candidate >= size * size) break; if (!isOpen(candidate) && !mineAt(candidate)) candidates.push(candidate); }
  if (candidates.length) state.opened.push(candidates[0]);
}

function revealOrdinaryMine() {
  const candidates = state.mines.filter((entry) => entry.type === "normal" && !isOpen(entry.index));
  if (!candidates.length) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  state.opened.push(target.index);
  return cellName(target.index);
}

function replaceOrdinaryMineWithPepper() {
  const candidates = state.mines.filter((entry) => entry.type === "normal" && !isOpen(entry.index));
  if (!candidates.length) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  target.type = "pepper";
  target.normalCredit = true;
  return cellName(target.index);
}

function applyMineEffect(mine, index) {
  const item = mineType(mine.type);
  if (["yinYang", "sunflower"].includes(mine.type)) state.base += mine.type === "yinYang" ? 500 : 200;
  if (mine.type === "pea") {
    const revealed = revealOrdinaryMine();
    return revealed ? `${item.effect}（位置 ${revealed}）` : "没有可自动翻开的普通雷";
  }
  if (mine.type === "burst") {
    const replaced = replaceOrdinaryMineWithPepper();
    return replaced ? `${item.effect}（位置 ${replaced}）` : "没有可替换的普通雷";
  }
  return item.effect;
}

function showTaskDialog(task) {
  const item = mineType(task.mineType);
  showDialog(`<div class="dialog-body task-dialog"><span class="task-kicker">TASK CHECK / ${item.name}</span><h2 id="dialogTitle">${item.name}任务待判定</h2><p class="task-question">下一局任务要求：<strong>${item.task}</strong></p><p>完成下一局后再判定结果。成功不会额外扣次数，失败会额外扣 1 次挖雷；关闭弹窗后可从棋盘下方的待判定任务入口再次打开。</p><div class="task-result-actions"><button class="primary-button" data-action="task-success" type="button">任务成功</button><button class="danger-button" data-action="task-fail" type="button">任务失败</button></div><div class="dialog-actions"><button class="secondary-button" data-action="close" type="button">稍后判定</button></div></div>`);
}

function resolveTask(success) {
  if (!state.pendingTask) return;
  pushHistory();
  const task = state.pendingTask;
  const item = mineType(task.mineType);
  state.pendingTask = null;
  if (success) {
    addEvent(`${item.name}任务判定：成功，不扣额外挖雷次数`, true, false);
    setMessage(`${item.name}任务成功，本次不扣额外挖雷次数。`, "success");
  } else {
    state.digs -= 1;
    addEvent(`${item.name}任务判定：失败，挖雷次数 -1（当前 ${state.digs}）`, true, false);
    setMessage(`${item.name}任务失败，额外扣除 1 次挖雷；当前为 ${state.digs}。`, "error");
  }
  closeDialog();
  renderAll();
  scheduleSave(`${item.name}任务判定`, "task_result");
}

function openCell(index) {
  if (state.phase !== "play" || state.settled || isOpen(index)) return;
  if (mineDone()) { setMessage("已找到全部普通雷，挖雷部分已经结束。", "success"); renderAll(); return; }
  if (state.digs <= 0) { setMessage("当前挖雷次数为 0 或负数，不能继续翻格。", "error"); renderAll(); return; }
  const candidate = mineAt(index);
  if (state.pendingTask && candidate && isTaskMine(candidate.type)) { showTaskDialog(state.pendingTask); setMessage("请先完成当前待判定任务，再翻开下一张任务雷。", "error"); return; }
  pushHistory(); state.digs -= 1; state.opened.push(index);
  const mine = candidate;
  if (mine) { const effect = applyMineEffect(mine, index); if (isTaskMine(mine.type)) state.pendingTask = { mineType: mine.type, index }; addEvent(`翻开 ${cellName(index)}：找到${mineType(mine.type).name}，${effect}`, true, false); setMessage(mineDone() ? "已找到全部普通雷，挖雷部分结束！" : `找到${mineType(mine.type).name}，还剩 ${Math.max(0, normalTarget() - normalFoundMines())} 颗普通雷。`, "success"); }
  else { addEvent(`翻开 ${cellName(index)}：安全格`, false, false); setMessage(`该格安全，当前挖雷次数 ${state.digs}。`); }
  renderAll(); if (state.pendingTask) showTaskDialog(state.pendingTask); scheduleSave("翻开棋盘格", "cell_open");
}

function recordWithdrawal() {
  if (state.phase !== "play" || state.settled) return;
  const result = previewCalculation();
  if (result.amount <= 0 && result.byLoot <= 0) { setMessage("请输入撤离价值，或勾选至少一项高价值物资。", "error"); return; }
  pushHistory(); state.base -= Math.round(result.amount); state.digs += result.awarded;
  const lootText = selectedLoot().map((item) => item.label).join("、") || "无额外物资";
  addEvent(`撤离成功：${Math.round(result.amount)}W；${lootText}；挖雷次数 +${result.awarded}`, true, false); setMessage(`撤离结果已记录：挖雷次数增加 ${result.awarded}，当前为 ${state.digs}。`, "success");
  els.withdrawInput.value = ""; state.lootSelections = []; renderAll(); scheduleSave("记录撤离成功", "withdraw_success");
}

function recordFailure() { if (state.phase !== "play" || state.settled) return; pushHistory(); state.base += 60; state.digs -= 1; addEvent(`撤离失败：基础保底 +60W，挖雷次数 -1（当前 ${state.digs}）`, true, false); setMessage(`撤离失败：保底 +60W，当前挖雷次数 ${state.digs}。`, "error"); renderAll(); scheduleSave("记录撤离失败", "withdraw_failed"); }

function clearOrRedeploy() {
  if (state.phase === "setup") { pushHistory(); autoDeployBoard(); setMessage(`已重新随机部署 ${totalMineTarget()} 个雷，可继续拖动调整。`, "success"); addEvent("重新随机部署地雷", false, false); renderAll(); scheduleSave("重新随机部署地雷", "deploy_randomize"); return; }
  showDialog(`<div class="dialog-body"><h2 id="dialogTitle">重新部署地图？</h2><p>棋盘、挖雷次数、保底和日志都会按当前规格重置。</p><div class="dialog-actions"><button class="primary-button" data-action="confirm-reset" type="button">确认重置</button><button class="secondary-button" data-action="close" type="button">取消</button></div></div>`);
}

function resetGame() { state.phase = "setup"; state.opened = []; state.pendingTask = null; state.digs = 0; state.base = spec().base; state.selectedMine = "normal"; state.lootSelections = []; state.settled = false; state.events = []; state.history = []; autoDeployBoard(); addEvent(`新一局开始：${spec().size}×${spec().size} / 自动部署${totalMineTarget()}雷`, true, false); setMessage(`已自动部署 ${totalMineTarget()} 个雷，可拖动交换位置。`, "success"); closeDialog(); renderAll(); scheduleSave("重开并自动部署扫雷游戏", "game_reset"); }
function settleGame() { if (!mineDone() || !baseDone() || state.settled) return; showDialog(`<div class="dialog-body"><h2 id="dialogTitle">确认正式结单？</h2><p>4 颗普通雷已经找到，挖雷部分结束；基础保底为 ${state.base}W。结单后本局锁定。</p><div class="result-value">通关</div><div class="dialog-actions"><button class="primary-button" data-action="confirm-settle" type="button">确认结单</button><button class="secondary-button" data-action="close" type="button">暂不结单</button></div></div>`); }
function confirmSettle() { pushHistory(); state.settled = true; state.phase = "settled"; addEvent(`正式结单：找到全部普通雷，基础保底 ${state.base}W`, true, false); closeDialog(); setMessage("本局已正式结单。", "success"); renderAll(); scheduleSave("正式结单", "game_settle"); }
function undo() { if (!state.history.length || state.settled) return; const previous = state.history.pop(); restoreSnapshot(previous); addEvent("撤回上一步操作", false, false); setMessage("已撤回上一步操作。"); renderAll(); scheduleSave("撤回操作", "undo"); }

function serializableState() { return { version: 5, game: "minesweeper-battle", spec: state.spec, phase: state.phase, selectedMine: state.selectedMine, mines: state.mines, opened: state.opened, pendingTask: state.pendingTask, digs: state.digs, base: state.base, lootSelections: state.lootSelections, settled: state.settled, events: state.events, history: state.history.slice(-30) }; }
function applyState(next) {
  if (Number(next.version) !== 5) return false;
  const index = Math.max(0, Math.min(SPECS.length - 1, Number(next.spec) || 0)); const max = SPECS[index].size ** 2;
  if (!Array.isArray(next.mines)) return false;
  const mines = next.mines.map((mine) => typeof mine === "number" ? { index: mine, type: "normal", normalCredit: false } : { index: Number(mine.index), type: mineType(mine.type).key, normalCredit: Boolean(mine.normalCredit) }).filter((mine) => Number.isInteger(mine.index) && mine.index >= 0 && mine.index < max);
  state.spec = index; state.phase = ["setup", "play", "settled"].includes(next.phase) ? next.phase : "setup"; state.selectedMine = mineType(next.selectedMine).key; state.mines = mines.map((mine) => ({ ...mine, normalCredit: Boolean(mine.normalCredit) })).filter((mine, position, list) => list.findIndex((item) => item.index === mine.index) === position); state.opened = Array.isArray(next.opened) ? [...new Set(next.opened.filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < max))] : []; state.pendingTask = next.pendingTask && isTaskMine(next.pendingTask.mineType) && Number.isInteger(Number(next.pendingTask.index)) ? { mineType: next.pendingTask.mineType, index: Number(next.pendingTask.index) } : null; state.digs = Number.isFinite(Number(next.digs)) ? Number(next.digs) : 0; state.base = Number.isFinite(Number(next.base)) ? Number(next.base) : SPECS[index].base; state.lootSelections = Array.isArray(next.lootSelections) ? next.lootSelections.filter((key) => LOOT_OPTIONS.some((item) => item.key === key)) : []; state.settled = Boolean(next.settled); state.events = Array.isArray(next.events) ? next.events.slice(0, 80) : []; state.history = Array.isArray(next.history) ? next.history.slice(-30) : []; return true;
}
function persistLocal() { if (!roomCode) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState())); } catch (_) {} }
function restoreLocal() { if (roomCode) return false; try { const raw = localStorage.getItem(STORAGE_KEY); const saved = JSON.parse(raw || "null"); return Boolean(saved && applyState(saved)); } catch (_) { return false; } }
function scheduleSave(message = "更新扫雷数据", eventType = "state_update") { if (isApplyingRemote) return; persistLocal(); clearTimeout(saveTimer); if (roomCode) { els.saveStatus.textContent = "房间同步中..."; els.roomSyncText.textContent = "同步中..."; saveTimer = setTimeout(() => saveRoom(message, eventType), 220); } else if (sessionId) { els.saveStatus.textContent = "保存中..."; saveTimer = setTimeout(saveSession, 260); } }
async function createSession() { try { const response = await fetch("/api/game-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameSlug: "minesweeper-battle", state: serializableState() }) }); if (!response.ok) throw new Error(); const session = await response.json(); sessionId = session.id; els.saveStatus.textContent = "已自动保存"; } catch (_) { els.saveStatus.textContent = "本地自动保存"; } }
async function saveSession() { try { const response = await fetch(`/api/game-sessions/${sessionId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: serializableState() }) }); if (!response.ok) throw new Error(); els.saveStatus.textContent = "已自动保存"; } catch (_) { els.saveStatus.textContent = "本地自动保存"; } }
async function loadRoom() { if (!roomCode) return false; try { const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { headers: { Accept: "application/json" } }); const room = await response.json().catch(() => ({})); if (!response.ok) throw new Error(room.error || "房间不存在"); roomCode = room.code; roomRevision = room.revision; els.roomBar.hidden = false; els.roomCodeText.textContent = room.code; els.roomSyncText.textContent = "已连接"; els.saveStatus.textContent = "房间已连接"; document.title = `${room.gameName} · ${room.code}`; if (!room.state || !applyState(room.state)) { autoDeployBoard(); addEvent(`房间 ${room.code} 开始：已自动部署 ${totalMineTarget()} 个雷`, true, false); await saveRoom("初始化三角洲扫雷大作战", "room_init"); } pollTimer = setInterval(pollRoom, 1500); return true; } catch (error) { els.roomBar.hidden = false; els.roomCodeText.textContent = roomCode; els.roomSyncText.textContent = error.message; els.saveStatus.textContent = "房间连接失败"; setMessage(`房间连接失败：${error.message}`, "error"); return false; } }
async function pollRoom() { try { const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { headers: { Accept: "application/json" } }); if (!response.ok) return; const room = await response.json(); if (room.revision <= roomRevision) { els.roomSyncText.textContent = "已同步"; return; } roomRevision = room.revision; isApplyingRemote = true; applyState(room.state || {}); renderAll(); isApplyingRemote = false; els.roomSyncText.textContent = "收到更新"; } catch (_) { els.roomSyncText.textContent = "同步失败"; } }
async function saveRoom(message, eventType) { try { const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: serializableState(), eventType, actor: "房间玩家", message, payload: { spec: `${spec().size}x${spec().size}`, base: state.base, digs: state.digs } }) }); if (!response.ok) throw new Error(); const room = await response.json(); roomRevision = room.revision; els.saveStatus.textContent = "房间已保存"; els.roomSyncText.textContent = "已同步"; } catch (_) { els.saveStatus.textContent = "房间保存失败"; els.roomSyncText.textContent = "保存失败"; } }

function showDialog(html) { els.dialogContent.innerHTML = html; els.dialogBackdrop.hidden = false; document.body.style.overflow = "hidden"; requestAnimationFrame(() => els.dialogContent.querySelector("button")?.focus()); }
function closeDialog() { els.dialogBackdrop.hidden = true; document.body.style.overflow = ""; }
function showHelp() { showDialog(`<div class="dialog-body"><h2 id="dialogTitle">三角洲扫雷作战规则</h2><p>开局会自动部署全部地雷，老板只需要调整位置并确认布局。</p><ol><li>4×4 棋盘固定放入：普通雷 4、向日葵 2、阴阳向日葵 2、排雷豌豆 1、窝瓜雷 3、土豆雷 1、辣椒雷 2、爆裂菜问 1，共 16 个。</li><li>部署阶段可拖动任意两格交换位置；手机或不方便拖动时，可依次点击两格交换。</li><li>确认布局后所有雷型隐藏，进入翻格阶段；不设置旗子、不显示数字提示。</li><li>挖雷次数为 0 或负数时不能继续翻格；找到 4 颗普通雷后挖雷部分结束。</li><li>窝瓜雷、土豆雷、辣椒雷翻出后记录为待判定任务；失败额外扣 1 次挖雷。</li><li>阴阳向日葵增加 500W 保底，向日葵增加 200W；排雷豌豆自动翻开 1 个普通雷，爆裂菜问随机把 1 个未翻开的普通雷替换成辣椒雷。</li><li>高价值物资支持多选；挖雷结束后仍可继续记录撤离结果并进行结单。</li></ol><div class="dialog-actions"><button class="primary-button" data-action="close" type="button">知道了</button></div></div>`); }

els.specList.addEventListener("click", (event) => { const button = event.target.closest("[data-spec]"); if (button) chooseSpec(Number(button.dataset.spec)); });
els.mineBoard.addEventListener("click", (event) => { const button = event.target.closest("[data-index]"); if (!button) return; const index = Number(button.dataset.index); state.phase === "setup" ? selectOrSwapMine(index) : openCell(index); });
els.mineBoard.addEventListener("dragstart", (event) => { const button = event.target.closest("[data-index]"); if (!button || state.phase !== "setup" || !mineAt(Number(button.dataset.index))) { event.preventDefault(); return; } dragSource = Number(button.dataset.index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(dragSource)); button.classList.add("dragging"); });
els.mineBoard.addEventListener("dragover", (event) => { const button = event.target.closest("[data-index]"); if (!button || state.phase !== "setup" || dragSource === null) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; els.mineBoard.querySelectorAll(".drop-target").forEach((cell) => cell.classList.remove("drop-target")); button.classList.add("drop-target"); });
els.mineBoard.addEventListener("dragleave", (event) => { event.target.closest("[data-index]")?.classList.remove("drop-target"); });
els.mineBoard.addEventListener("drop", (event) => { const button = event.target.closest("[data-index]"); if (!button || state.phase !== "setup") return; event.preventDefault(); const sourceIndex = Number(event.dataTransfer.getData("text/plain") || dragSource); const targetIndex = Number(button.dataset.index); swapMinePositions(sourceIndex, targetIndex, "拖动"); });
els.mineBoard.addEventListener("dragend", () => { dragSource = null; els.mineBoard.querySelectorAll(".dragging, .drop-target").forEach((cell) => cell.classList.remove("dragging", "drop-target")); });
els.lockMapBtn.addEventListener("click", lockMap); els.redeployBtn.addEventListener("click", clearOrRedeploy); els.calculatorForm.addEventListener("submit", (event) => { event.preventDefault(); recordWithdrawal(); });
els.withdrawInput.addEventListener("input", previewCalculation); els.lootOptions.addEventListener("change", () => { state.lootSelections = [...els.lootOptions.querySelectorAll("input[name=loot]:checked")].map((input) => input.value); previewCalculation(); renderStatus(); });
els.selectAllLoot.addEventListener("change", () => { state.lootSelections = els.selectAllLoot.checked ? LOOT_OPTIONS.map((item) => item.key) : []; renderAll(); });
els.failBtn.addEventListener("click", recordFailure); els.undoBtn.addEventListener("click", undo); els.settleBtn.addEventListener("click", settleGame); els.helpBtn.addEventListener("click", showHelp); els.restartBtn.addEventListener("click", clearOrRedeploy); els.dialogClose.addEventListener("click", closeDialog); els.dialogBackdrop.addEventListener("click", (event) => { if (event.target === els.dialogBackdrop) closeDialog(); });
els.dialogContent.addEventListener("click", (event) => { const action = event.target.closest("[data-action]")?.dataset.action; if (action === "close") closeDialog(); if (action === "confirm-reset") resetGame(); if (action === "confirm-settle") confirmSettle(); if (action === "task-success") resolveTask(true); if (action === "task-fail") resolveTask(false); });
els.pendingTaskBtn.addEventListener("click", () => { if (state.pendingTask) showTaskDialog(state.pendingTask); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDialog(); }); window.addEventListener("beforeunload", () => { persistLocal(); clearInterval(pollTimer); });

async function initialize() { const roomLoaded = await loadRoom(); if (!roomLoaded) { const restored = restoreLocal(); if (!restored || (state.phase === "setup" && !layoutMatchesTarget())) { autoDeployBoard(); addEvent(`新一局开始：${spec().size}×${spec().size} / 已自动部署 ${totalMineTarget()} 个雷`, true, false); } await createSession(); } renderAll(); if (!localStorage.getItem(`${STORAGE_KEY}-helped`)) { setTimeout(() => { showHelp(); localStorage.setItem(`${STORAGE_KEY}-helped`, "1"); }, 420); } }
initialize();
