const gameRoutes = {
  "mo-hong-tianping": "/games/mo-hong-tianping.html",
  "bingo2-super": "/games/bingo2-super.html",
  "minesweeper-battle": "/games/minesweeper-battle.html"
};

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function roomTarget(room) {
  let href = room.gameHref || gameRoutes[room.gameSlug] || "/";
  if (href.startsWith("./")) href = `/${href.slice(2)}`;
  else if (!href.startsWith("/") && !/^https?:\/\//i.test(href)) href = `/${href}`;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}room=${encodeURIComponent(room.code)}`;
}

function mountRoomEntry() {
  if (document.querySelector("#roomEntry")) return;
  const box = document.createElement("aside");
  box.className = "room-entry";
  box.id = "roomEntry";
  box.innerHTML = `
    <form id="roomEntryForm">
      <label>
        进入房间
        <input id="roomCodeInput" type="text" placeholder="例如 XJ-7KQ9M" autocomplete="off" />
      </label>
      <button type="submit">进入</button>
    </form>
    <div class="room-entry-message" id="roomEntryMessage"></div>
  `;
  document.body.appendChild(box);

  const form = box.querySelector("#roomEntryForm");
  const input = box.querySelector("#roomCodeInput");
  const message = box.querySelector("#roomEntryMessage");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = normalizeRoomCode(input.value);
    if (!code) {
      message.textContent = "请输入房间号。";
      message.classList.add("error");
      return;
    }
    message.textContent = "正在进入房间...";
    message.classList.remove("error");
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, { headers: { Accept: "application/json" } });
      const room = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(room.error || "房间不存在");
      window.location.href = roomTarget(room);
    } catch (error) {
      message.textContent = error.message || "进入失败";
      message.classList.add("error");
    }
  });
}

mountRoomEntry();
