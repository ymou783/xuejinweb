const SPECS = [
  { size: 4, mines: 4, price: 888, base: 2288 },
  { size: 6, mines: 12, price: 2888, base: 8888 },
  { size: 8, mines: 26, price: 4888, base: 15888 }
];

const MINE_TYPES = [
  { key: "normal", name: "普通雷", asset: "normal", limit: "board", summary: "基础预埋雷", detail: "按棋盘的普通雷数量部署。翻到后计入找到雷数，全部地雷找到即可完成扫雷条件。", effect: "翻到：找到 1 颗地雷" },
  { key: "wogua", name: "窝瓜雷", asset: "wogua", limit: 3, summary: "惩罚型任务雷", detail: "翻到后会额外消耗 1 次挖雷次数，适合放在需要控制次数的挑战局。", effect: "触发后额外消耗 1 次挖雷" },
  { key: "yinYang", name: "阴阳向日葵", asset: "yin-yang", limit: 2, summary: "保底增益雷", detail: "翻到后立即增加当前基础保底 200W，和向日葵的增益效果相同。", effect: "触发后保底增加 200W" },
  { key: "potato", name: "土豆雷", asset: "potato", limit: 2, summary: "惩罚型任务雷", detail: "翻到后会额外消耗 1 次挖雷次数，触发结果会写入事件记录。", effect: "触发后额外消耗 1 次挖雷" },
  { key: "sunflower", name: "向日葵", asset: "sunflower", limit: 2, summary: "保底增益雷", detail: "翻到后立即增加当前基础保底 200W，适合用来抬高本局保底。", effect: "触发后保底增加 200W" },
  { key: "pea", name: "排雷豌豆", asset: "pea-sweeper", limit: 2, summary: "自动排雷雷", detail: "翻到后会从后续格子中自动翻开一格安全格，帮助扩大探索范围。", effect: "触发后自动翻开一格安全格" },
  { key: "pepper", name: "辣椒雷", asset: "pepper", limit: 1, summary: "同列联动雷", detail: "翻到后会沿当前格子的同列自动翻开一格安全格。", effect: "触发后自动翻开同列一格" },
  { key: "burst", name: "爆裂菜问", asset: "burst-cabbage", limit: 1, summary: "全图揭示雷", detail: "翻到后公开剩余未翻开的地雷位置，用于快速确认整张雷区。", effect: "触发后公开剩余地雷" }
];

const LOOT_OPTIONS = [
  { key: "small_red", label: "六格及以内小红", detail: "带出 +1 次", digs: 1 },
  { key: "big_red", label: "八格及以上大红", detail: "带出 +2 次", digs: 2 },
  { key: "heart", label: "非洲之心 / 海洋之泪", detail: "带出 +3 次", digs: 3 },
  { key: "revive", label: "复苏呼吸机", detail: "带出 +3 次", digs: 3 }
];

const STORAGE_KEY = "xuejin-minesweeper-deploy-v4";
let roomCode = new URLSearchParams(location.search).get("room")?.trim().toUpperCase() || "";
let roomRevision = -1;
let sessionId = "";
let saveTimer = null;
let pollTimer = null;
let isApplyingRemote = false;

const state = {
  version: 3,
  game: "minesweeper-battle",
  spec: 0,
  phase: "setup",
  selectedMine: "normal",
  mines: [],
  opened: [],
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
function mineAt(index) { return state.mines.find((mine) => mine.index === index) || null; }
function isOpen(index) { return state.opened.includes(index); }
function foundMines() { return state.opened.filter((index) => mineAt(index)).length; }
function normalTarget() { return spec().mines; }
function specialTarget() { return spec().mines; }
function totalMineTarget() { return normalTarget() + specialTarget(); }
function normalCount() { return mineCount("normal"); }
function specialCount() { return state.mines.length - normalCount(); }
function mineDone() { return foundMines() >= totalMineTarget() && state.mines.length === totalMineTarget() && normalCount() === normalTarget() && specialCount() === specialTarget(); }
function baseDone() { return state.base < 0; }
function cellName(index) { return `${String.fromCharCode(65 + Math.floor(index / spec().size))}${index % spec().size + 1}`; }
function timeLabel() { return new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function amountDigs(amount) { if (amount >= 1500) return 4; if (amount >= 1300) return 3; if (amount >= 1000) return 2; if (amount >= 800) return 1; return 0; }
function selectedLoot() { return LOOT_OPTIONS.filter((item) => state.lootSelections.includes(item.key)); }
function lootDigs() { return selectedLoot().reduce((sum, item) => sum + item.digs, 0); }
function mineCount(key) { return state.mines.filter((mine) => mine.type === key).length; }
function mineLimit(item) { return item.limit === "board" ? normalTarget() : specialTarget(); }

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
  return { spec: state.spec, phase: state.phase, selectedMine: state.selectedMine, mines: state.mines.map((mine) => ({ ...mine })), opened: [...state.opened], digs: state.digs, base: state.base, lootSelections: [...state.lootSelections], settled: state.settled, events: state.events.map((item) => ({ ...item })) };
}
function pushHistory() { state.history.push(snapshotState()); state.history = state.history.slice(-60); }
function restoreSnapshot(previous) { Object.assign(state, { spec: previous.spec, phase: previous.phase, selectedMine: previous.selectedMine || "normal", mines: previous.mines.map((mine) => ({ ...mine })), opened: [...previous.opened], digs: previous.digs, base: previous.base, lootSelections: [...(previous.lootSelections || [])], settled: previous.settled, events: previous.events.map((item) => ({ ...item })) }); }
function addEvent(message, important = false, save = true) { state.events.unshift({ time: timeLabel(), message, important }); state.events = state.events.slice(0, 80); if (save) scheduleSave(message, important ? "important" : "state_update"); }
function setMessage(text, type = "") { els.gameMessage.className = `message ${type}`.trim(); els.gameMessage.textContent = text; }

function miniMinePositions(size, count) {
  const total = size * size;
  const picks = new Set();
  for (let index = 0; index < total && picks.size < count; index += 1) picks.add((index * (total - 1) + size) % total);
  return picks;
}

function renderSpecs() {
  els.specList.innerHTML = SPECS.map((item, index) => {
    const miniMines = miniMinePositions(item.size, item.mines);
    const mini = Array.from({ length: item.size ** 2 }, (_, cell) => `<i class="${miniMines.has(cell) ? "mine" : ""}"></i>`).join("");
    return `<button class="spec-card ${state.spec === index ? "active" : ""}" type="button" data-spec="${index}" ${state.phase !== "setup" || state.mines.length ? "disabled" : ""}><span class="spec-preview" style="--mini-size:${item.size}">${mini}</span><span class="spec-copy"><strong><b>${item.size}×${item.size}</b> / 普通${item.mines}+特殊${item.mines}</strong><span>${item.price}R</span><small>基础保底 <b>${item.base}W</b></small></span></button>`;
  }).join("");
}

function renderMineTypes() {
  els.mineTypeList.innerHTML = MINE_TYPES.map((item) => {
    const count = mineCount(item.key);
    const limit = mineLimit(item);
    const stock = item.limit === "board" ? `${count}/${limit}` : `${Math.max(0, specialTarget() - specialCount())}/${specialTarget()}`;
    const stockLabel = item.limit === "board" ? "已埋" : "特殊可用";
    const exhausted = item.limit === "board" ? count >= limit : specialCount() >= specialTarget();
    return `<button class="mine-type-card ${state.selectedMine === item.key ? "selected" : ""} ${exhausted ? "exhausted" : ""}" type="button" data-mine-type="${item.key}" ${state.phase !== "setup" ? "disabled" : ""}><i class="mine-icon card-${item.asset}" aria-hidden="true"></i><span class="mine-type-copy"><strong>${item.name}</strong><small>${item.effect}</small></span><span class="mine-stock"><small>${stockLabel}</small><b>${stock}</b></span></button>`;
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
  els.mineBoard.style.setProperty("--size", item.size);
  els.boardFrame.style.setProperty("--size", item.size);
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
      if (mine) { className += " deployed"; content = `<i class="mine-cell-art card-${mineType(mine.type).asset}" aria-hidden="true"></i>`; label = `${cellName(index)}，已部署${mineType(mine.type).name}`; } else className += " covered";
    } else if (open) {
      if (mine) { className += " open mine-found"; content = `<i class="mine-cell-art card-${mineType(mine.type).asset}" aria-hidden="true"></i>`; label = `${cellName(index)}，找到${mineType(mine.type).name}`; } else { className += " open safe"; label = `${cellName(index)}，安全格`; }
    } else className += " covered";
    return `<button class="${className}" type="button" role="gridcell" data-index="${index}" aria-label="${label}" aria-rowindex="${Math.floor(index / item.size) + 1}" aria-colindex="${index % item.size + 1}" ${state.settled ? "disabled" : ""}>${content}</button>`;
  }).join("");
}

function renderStatus() {
  const item = spec();
  const found = foundMines();
  els.missionText.textContent = state.settled ? "本局已结单" : state.phase === "setup" ? `部署普通雷 ${normalCount()}/${normalTarget()} + 特殊雷 ${specialCount()}/${specialTarget()}` : "地图已锁定，按结果翻开格子";
  els.phaseText.textContent = state.settled ? "已结单" : state.phase === "setup" ? "部署地雷" : "翻开格子";
  els.deployedCount.textContent = normalCount();
  els.mineTarget.textContent = normalTarget();
  els.specialDeployedCount.textContent = specialCount();
  els.specialTarget.textContent = specialTarget();
  els.foundCount.textContent = found;
  els.foundTarget.textContent = totalMineTarget();
  els.digCount.textContent = state.digs;
  els.boardKicker.textContent = `${item.size}×${item.size} / ${totalMineTarget()} 雷`;
  els.boardTitle.textContent = state.phase === "setup" ? "部署雷区" : mineDone() ? "全部地雷已找到" : "翻开格子找雷";
  els.boardHint.textContent = state.phase === "setup" ? `当前选择：${mineType(state.selectedMine).name}；点击格子部署或撤回。` : "每翻一个格子都会消耗 1 次，挖雷次数允许低于 0。";
  els.baseValue.textContent = Math.round(state.base).toLocaleString("zh-CN");
  const remainingNormal = normalTarget() - normalCount();
  const remainingSpecial = specialTarget() - specialCount();
  els.lockMapBtn.hidden = state.phase !== "setup";
  els.lockMapBtn.disabled = remainingNormal !== 0 || remainingSpecial !== 0;
  els.lockMapBtn.textContent = remainingNormal > 0 || remainingSpecial > 0 ? `还需普通 ${Math.max(0, remainingNormal)} + 特殊 ${Math.max(0, remainingSpecial)} 颗` : "保存地图并开始翻格";
  els.redeployBtn.textContent = state.phase === "setup" ? "清空部署" : "重新部署";
  const ready = mineDone() && baseDone() && !state.settled;
  els.settleBtn.disabled = !ready;
  els.settleBtn.textContent = state.settled ? "本局已结单" : ready ? "正式结单" : "结单条件未达成";
  els.mineCondition.textContent = mineDone() ? "扫雷已达成" : `扫雷未达成 ${found}/${totalMineTarget()}`;
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
  if (state.phase !== "setup" || state.mines.length || index === state.spec || !SPECS[index]) return;
  pushHistory(); state.spec = index; state.base = spec().base; state.opened = []; state.digs = 0; state.selectedMine = "normal";
  addEvent(`选择规格：${spec().size}×${spec().size} / 普通${normalTarget()}+特殊${specialTarget()}`, true, false);
  setMessage(`已选择 ${spec().size}×${spec().size}，请部署普通 ${normalTarget()} 颗和特殊 ${specialTarget()} 颗地雷。`); renderAll(); scheduleSave("切换扫雷规格", "spec_change");
}

function chooseMineType(key) { if (state.phase !== "setup" || !mineType(key)) return; state.selectedMine = key; setMessage(`已选择 ${mineType(key).name}：${mineType(key).effect}`); renderAll(); }

function toggleMine(index) {
  if (state.phase !== "setup" || state.settled) return;
  const existing = mineAt(index);
  pushHistory();
  if (existing) { state.mines = state.mines.filter((mine) => mine.index !== index); setMessage(`已撤回 ${cellName(index)} 的${mineType(existing.type).name}。`); }
  else {
    const selected = mineType(state.selectedMine); const limit = mineLimit(selected); const used = selected.key === "normal" ? normalCount() : specialCount();
    if (state.mines.length >= totalMineTarget()) { state.history.pop(); setMessage(`本局最多部署普通 ${normalTarget()} + 特殊 ${specialTarget()} 颗地雷，请先撤回一格。`, "error"); return; }
    if (used >= limit) { state.history.pop(); setMessage(`${selected.name} 所属${selected.key === "normal" ? "普通雷" : "特殊雷"}数量已达到上限，请更换雷型。`, "error"); return; }
    state.mines.push({ index, type: selected.key }); setMessage(`已在 ${cellName(index)} 部署${selected.name}（普通 ${normalCount()}/${normalTarget()}，特殊 ${specialCount()}/${specialTarget()}）。`);
  }
  renderAll(); scheduleSave("调整地雷部署", "mine_deploy");
}

function lockMap() {
  if (state.phase !== "setup" || state.mines.length !== totalMineTarget() || normalCount() !== normalTarget() || specialCount() !== specialTarget()) return;
  pushHistory(); state.phase = "play"; state.opened = []; state.digs = 0;
  addEvent(`地图已保存：普通${normalCount()} + 特殊${specialCount()}，进入翻格阶段`, true, false); setMessage("地图已隐藏。记录撤离结果后，点击格子开始挖雷。", "success"); renderAll(); scheduleSave("保存地图并进入翻格阶段", "map_lock");
}

function revealBonusCell(index, sameColumn = false) {
  const size = spec().size; const candidates = [];
  for (let step = 1; step < size; step += 1) { const candidate = sameColumn ? index + step * size : index + step; if (candidate >= size * size) break; if (!isOpen(candidate) && !mineAt(candidate)) candidates.push(candidate); }
  if (candidates.length) state.opened.push(candidates[0]);
}

function applyMineEffect(mine, index) {
  const item = mineType(mine.type);
  if (["wogua", "potato"].includes(mine.type)) state.digs -= 1;
  if (["yinYang", "sunflower"].includes(mine.type)) state.base += 200;
  if (mine.type === "pea") revealBonusCell(index);
  if (mine.type === "pepper") revealBonusCell(index, true);
  if (mine.type === "burst") state.mines.forEach((entry) => { if (!state.opened.includes(entry.index)) state.opened.push(entry.index); });
  return item.effect;
}

function openCell(index) {
  if (state.phase !== "play" || state.settled || isOpen(index)) return;
  pushHistory(); state.digs -= 1; state.opened.push(index);
  const mine = mineAt(index);
  if (mine) { const effect = applyMineEffect(mine, index); addEvent(`翻开 ${cellName(index)}：找到${mineType(mine.type).name}，${effect}`, true, false); setMessage(mineDone() ? "已找到全部地雷，扫雷条件达成！" : `找到${mineType(mine.type).name}，还剩 ${Math.max(0, state.mines.length - foundMines())} 颗。`, "success"); }
  else { addEvent(`翻开 ${cellName(index)}：安全格`, false, false); setMessage(`该格安全，当前挖雷次数 ${state.digs}。`); }
  renderAll(); scheduleSave("翻开棋盘格", "cell_open");
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
  if (state.phase === "setup") { if (!state.mines.length) return; pushHistory(); state.mines = []; setMessage("部署已清空，请重新选择雷型并放置。"); renderAll(); scheduleSave("清空地雷部署", "deploy_clear"); return; }
  showDialog(`<div class="dialog-body"><h2 id="dialogTitle">重新部署地图？</h2><p>棋盘、挖雷次数、保底和日志都会按当前规格重置。</p><div class="dialog-actions"><button class="primary-button" data-action="confirm-reset" type="button">确认重置</button><button class="secondary-button" data-action="close" type="button">取消</button></div></div>`);
}

function resetGame() { state.phase = "setup"; state.mines = []; state.opened = []; state.digs = 0; state.base = spec().base; state.selectedMine = "normal"; state.lootSelections = []; state.settled = false; state.events = []; state.history = []; addEvent(`新一局开始：${spec().size}×${spec().size} / 普通${normalTarget()}+特殊${specialTarget()}`, true, false); setMessage(`请部署普通 ${normalTarget()} 颗和特殊 ${specialTarget()} 颗地雷。`); closeDialog(); renderAll(); scheduleSave("重开扫雷游戏", "game_reset"); }
function settleGame() { if (!mineDone() || !baseDone() || state.settled) return; showDialog(`<div class="dialog-body"><h2 id="dialogTitle">确认正式结单？</h2><p>全部 ${totalMineTarget()} 颗地雷（普通 ${normalTarget()} + 特殊 ${specialTarget()}）已经找到，基础保底为 ${state.base}W。结单后本局锁定。</p><div class="result-value">通关</div><div class="dialog-actions"><button class="primary-button" data-action="confirm-settle" type="button">确认结单</button><button class="secondary-button" data-action="close" type="button">暂不结单</button></div></div>`); }
function confirmSettle() { pushHistory(); state.settled = true; state.phase = "settled"; addEvent(`正式结单：找到全部地雷，基础保底 ${state.base}W`, true, false); closeDialog(); setMessage("本局已正式结单。", "success"); renderAll(); scheduleSave("正式结单", "game_settle"); }
function undo() { if (!state.history.length || state.settled) return; const previous = state.history.pop(); restoreSnapshot(previous); addEvent("撤回上一步操作", false, false); setMessage("已撤回上一步操作。"); renderAll(); scheduleSave("撤回操作", "undo"); }

function serializableState() { return { version: 3, game: "minesweeper-battle", spec: state.spec, phase: state.phase, selectedMine: state.selectedMine, mines: state.mines, opened: state.opened, digs: state.digs, base: state.base, lootSelections: state.lootSelections, settled: state.settled, events: state.events, history: state.history.slice(-30) }; }
function applyState(next) {
  const index = Math.max(0, Math.min(SPECS.length - 1, Number(next.spec) || 0)); const max = SPECS[index].size ** 2;
  if (!Array.isArray(next.mines)) return false;
  const mines = next.mines.map((mine) => typeof mine === "number" ? { index: mine, type: "normal" } : { index: Number(mine.index), type: mineType(mine.type).key }).filter((mine) => Number.isInteger(mine.index) && mine.index >= 0 && mine.index < max);
  state.spec = index; state.phase = ["setup", "play", "settled"].includes(next.phase) ? next.phase : "setup"; state.selectedMine = mineType(next.selectedMine).key; state.mines = mines.filter((mine, position, list) => list.findIndex((item) => item.index === mine.index) === position); state.opened = Array.isArray(next.opened) ? [...new Set(next.opened.filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < max))] : []; state.digs = Number.isFinite(Number(next.digs)) ? Number(next.digs) : 0; state.base = Number.isFinite(Number(next.base)) ? Number(next.base) : SPECS[index].base; state.lootSelections = Array.isArray(next.lootSelections) ? next.lootSelections.filter((key) => LOOT_OPTIONS.some((item) => item.key === key)) : []; state.settled = Boolean(next.settled); state.events = Array.isArray(next.events) ? next.events.slice(0, 80) : []; state.history = Array.isArray(next.history) ? next.history.slice(-30) : []; return true;
}
function persistLocal() { if (!roomCode) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState())); } catch (_) {} }
function restoreLocal() { if (roomCode) return false; try { const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("xuejin-minesweeper-deploy-v2"); const saved = JSON.parse(raw || "null"); return Boolean(saved && applyState(saved)); } catch (_) { return false; } }
function scheduleSave(message = "更新扫雷数据", eventType = "state_update") { if (isApplyingRemote) return; persistLocal(); clearTimeout(saveTimer); if (roomCode) { els.saveStatus.textContent = "房间同步中..."; els.roomSyncText.textContent = "同步中..."; saveTimer = setTimeout(() => saveRoom(message, eventType), 220); } else if (sessionId) { els.saveStatus.textContent = "保存中..."; saveTimer = setTimeout(saveSession, 260); } }
async function createSession() { try { const response = await fetch("/api/game-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameSlug: "minesweeper-battle", state: serializableState() }) }); if (!response.ok) throw new Error(); const session = await response.json(); sessionId = session.id; els.saveStatus.textContent = "已自动保存"; } catch (_) { els.saveStatus.textContent = "本地自动保存"; } }
async function saveSession() { try { const response = await fetch(`/api/game-sessions/${sessionId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: serializableState() }) }); if (!response.ok) throw new Error(); els.saveStatus.textContent = "已自动保存"; } catch (_) { els.saveStatus.textContent = "本地自动保存"; } }
async function loadRoom() { if (!roomCode) return false; try { const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { headers: { Accept: "application/json" } }); const room = await response.json().catch(() => ({})); if (!response.ok) throw new Error(room.error || "房间不存在"); roomCode = room.code; roomRevision = room.revision; els.roomBar.hidden = false; els.roomCodeText.textContent = room.code; els.roomSyncText.textContent = "已连接"; els.saveStatus.textContent = "房间已连接"; document.title = `${room.gameName} · ${room.code}`; if (!room.state || !applyState(room.state)) { addEvent(`房间 ${room.code} 开始：基础保底 ${state.base}W`, true, false); await saveRoom("初始化三角洲扫雷大作战", "room_init"); } pollTimer = setInterval(pollRoom, 1500); return true; } catch (error) { els.roomBar.hidden = false; els.roomCodeText.textContent = roomCode; els.roomSyncText.textContent = error.message; els.saveStatus.textContent = "房间连接失败"; setMessage(`房间连接失败：${error.message}`, "error"); return false; } }
async function pollRoom() { try { const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { headers: { Accept: "application/json" } }); if (!response.ok) return; const room = await response.json(); if (room.revision <= roomRevision) { els.roomSyncText.textContent = "已同步"; return; } roomRevision = room.revision; isApplyingRemote = true; applyState(room.state || {}); renderAll(); isApplyingRemote = false; els.roomSyncText.textContent = "收到更新"; } catch (_) { els.roomSyncText.textContent = "同步失败"; } }
async function saveRoom(message, eventType) { try { const response = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: serializableState(), eventType, actor: "房间玩家", message, payload: { spec: `${spec().size}x${spec().size}`, base: state.base, digs: state.digs } }) }); if (!response.ok) throw new Error(); const room = await response.json(); roomRevision = room.revision; els.saveStatus.textContent = "房间已保存"; els.roomSyncText.textContent = "已同步"; } catch (_) { els.saveStatus.textContent = "房间保存失败"; els.roomSyncText.textContent = "保存失败"; } }

function showDialog(html) { els.dialogContent.innerHTML = html; els.dialogBackdrop.hidden = false; document.body.style.overflow = "hidden"; requestAnimationFrame(() => els.dialogContent.querySelector("button")?.focus()); }
function closeDialog() { els.dialogBackdrop.hidden = true; document.body.style.overflow = ""; }
function showHelp() { showDialog(`<div class="dialog-body"><h2 id="dialogTitle">三角洲扫雷作战规则</h2><p>这是一局老板预埋、玩家翻格的雷区对局。你提供的 8 张卡已经绑定为 8 种雷型。</p><ol><li>选择 4×4、6×6 或 8×8 规格。</li><li>选择普通雷、窝瓜雷、阴阳向日葵、土豆雷、向日葵、排雷豌豆、辣椒雷、爆裂菜问，再点击棋盘部署。</li><li>普通雷按本局预埋数量计算，特殊雷额外部署同等数量，由其余 7 种雷共同分配。</li><li>记录撤离结果时，高价值物资支持多选并逐项叠加。</li><li>翻格不设最低次数，挖雷次数可以变成负数；找到全部地雷且保底小于 0 后即可结单。</li></ol><div class="dialog-actions"><button class="primary-button" data-action="close" type="button">知道了</button></div></div>`); }

els.specList.addEventListener("click", (event) => { const button = event.target.closest("[data-spec]"); if (button) chooseSpec(Number(button.dataset.spec)); });
els.mineTypeList.addEventListener("click", (event) => { const button = event.target.closest("[data-mine-type]"); if (button) chooseMineType(button.dataset.mineType); });
els.mineBoard.addEventListener("click", (event) => { const button = event.target.closest("[data-index]"); if (!button) return; const index = Number(button.dataset.index); state.phase === "setup" ? toggleMine(index) : openCell(index); });
els.lockMapBtn.addEventListener("click", lockMap); els.redeployBtn.addEventListener("click", clearOrRedeploy); els.calculatorForm.addEventListener("submit", (event) => { event.preventDefault(); recordWithdrawal(); });
els.withdrawInput.addEventListener("input", previewCalculation); els.lootOptions.addEventListener("change", () => { state.lootSelections = [...els.lootOptions.querySelectorAll("input[name=loot]:checked")].map((input) => input.value); previewCalculation(); renderStatus(); });
els.selectAllLoot.addEventListener("change", () => { state.lootSelections = els.selectAllLoot.checked ? LOOT_OPTIONS.map((item) => item.key) : []; renderAll(); });
els.failBtn.addEventListener("click", recordFailure); els.undoBtn.addEventListener("click", undo); els.settleBtn.addEventListener("click", settleGame); els.helpBtn.addEventListener("click", showHelp); els.restartBtn.addEventListener("click", clearOrRedeploy); els.dialogClose.addEventListener("click", closeDialog); els.dialogBackdrop.addEventListener("click", (event) => { if (event.target === els.dialogBackdrop) closeDialog(); });
els.dialogContent.addEventListener("click", (event) => { const action = event.target.closest("[data-action]")?.dataset.action; if (action === "close") closeDialog(); if (action === "confirm-reset") resetGame(); if (action === "confirm-settle") confirmSettle(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDialog(); }); window.addEventListener("beforeunload", () => { persistLocal(); clearInterval(pollTimer); });

async function initialize() { const roomLoaded = await loadRoom(); if (!roomLoaded) { const restored = restoreLocal(); if (!restored) addEvent(`新一局开始：${spec().size}×${spec().size} / 普通${normalTarget()}+特殊${specialTarget()}`, true, false); await createSession(); } renderAll(); if (!localStorage.getItem(`${STORAGE_KEY}-helped`)) { setTimeout(() => { showHelp(); localStorage.setItem(`${STORAGE_KEY}-helped`, "1"); }, 420); } }
initialize();
