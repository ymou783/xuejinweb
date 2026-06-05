import { checkAdmin, listRooms, loadRoomEvents } from "./api.js";

let token = localStorage.getItem("xuejin-admin-token") || "";
let rooms = [];
let selectedCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || "";

const loginScreen = document.querySelector("#loginScreen");
const logsApp = document.querySelector("#logsApp");
const loginForm = document.querySelector("#loginForm");
const loginPassword = document.querySelector("#loginPassword");
const loginStatus = document.querySelector("#loginStatus");
const logoutBtn = document.querySelector("#logoutBtn");
const refreshLogsBtn = document.querySelector("#refreshLogsBtn");
const roomSearchInput = document.querySelector("#roomSearchInput");
const logRoomsList = document.querySelector("#logRoomsList");
const roomEventsList = document.querySelector("#roomEventsList");
const selectedRoomTitle = document.querySelector("#selectedRoomTitle");
const selectedRoomMeta = document.querySelector("#selectedRoomMeta");
const statusEl = document.querySelector("#status");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `status logs-status ${type}`.trim();
}

function roomState(room) {
  if (room.deleted) return "已删除";
  if (room.settled) return "已结束";
  return "进行中";
}

function roomStateClass(room) {
  if (room.deleted) return "deleted";
  if (room.settled) return "ended";
  return "active";
}

function filteredRooms() {
  const keyword = roomSearchInput.value.trim().toLowerCase();
  if (!keyword) return rooms;
  return rooms.filter((room) => `${room.code} ${room.gameName}`.toLowerCase().includes(keyword));
}

function renderRooms() {
  const visibleRooms = filteredRooms();
  if (!visibleRooms.length) {
    logRoomsList.innerHTML = `<div class="empty-entry">暂无匹配房间。</div>`;
    return;
  }
  logRoomsList.innerHTML = visibleRooms.map((room) => `
    <button class="log-room ${room.code === selectedCode ? "active" : ""}" type="button" data-room-code="${escapeHtml(room.code)}">
      <strong>${escapeHtml(room.code)}</strong>
      <span>${escapeHtml(room.gameName)}</span>
      <em class="${roomStateClass(room)}">${roomState(room)}</em>
    </button>
  `).join("");
}

async function selectRoom(code) {
  selectedCode = code;
  renderRooms();
  const room = rooms.find((item) => item.code === code);
  selectedRoomTitle.textContent = room ? `${room.code} · ${room.gameName}` : code;
  selectedRoomMeta.textContent = room ? `${roomState(room)} · 创建 ${room.createdAt} · 更新 ${room.updatedAt}` : "";
  roomEventsList.textContent = "正在读取日志...";
  const events = await loadRoomEvents(code, token);
  if (!events.length) {
    roomEventsList.textContent = "这个房间没有日志。";
    return;
  }
  roomEventsList.innerHTML = events.map((event) => `
    <div class="room-event">
      <strong>#${event.id} ${escapeHtml(event.message || event.type)}</strong>
      <span>${escapeHtml(event.createdAt)} ${event.actor ? `· ${escapeHtml(event.actor)}` : ""} · ${escapeHtml(event.type)}</span>
    </div>
  `).join("");
  setStatus(`已读取 ${code} 的 ${events.length} 条日志。`, "ok");
}

async function refreshLogs() {
  setStatus("正在读取房间和日志...");
  rooms = await listRooms(token, { includeDeleted: true });
  renderRooms();
  if (selectedCode && rooms.some((room) => room.code === selectedCode)) {
    await selectRoom(selectedCode);
  } else if (rooms.length) {
    await selectRoom(rooms[0].code);
  } else {
    selectedRoomTitle.textContent = "暂无房间";
    selectedRoomMeta.textContent = "";
    roomEventsList.textContent = "暂无日志。";
    setStatus("暂无房间日志。");
  }
}

async function login(nextToken) {
  loginStatus.textContent = "正在登录...";
  loginStatus.className = "status";
  await checkAdmin(nextToken);
  token = nextToken;
  localStorage.setItem("xuejin-admin-token", token);
  loginScreen.hidden = true;
  logsApp.hidden = false;
  await refreshLogs();
}

function logout() {
  localStorage.removeItem("xuejin-admin-token");
  token = "";
  logsApp.hidden = true;
  loginScreen.hidden = false;
  loginPassword.value = "";
  loginStatus.textContent = "";
  loginPassword.focus();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login(loginPassword.value.trim()).catch((error) => {
    loginStatus.textContent = error.message;
    loginStatus.className = "status error";
  });
});

logoutBtn.addEventListener("click", logout);
refreshLogsBtn.addEventListener("click", () => refreshLogs().catch((error) => setStatus(error.message, "error")));
roomSearchInput.addEventListener("input", renderRooms);
logRoomsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-room-code]");
  if (button) selectRoom(button.dataset.roomCode).catch((error) => setStatus(error.message, "error"));
});

if (token) {
  login(token).catch(() => logout());
} else {
  loginPassword.focus();
}
