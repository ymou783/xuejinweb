import { checkAdmin, createRoom, deleteRoom, listRooms, loadSiteData, saveSiteData, uploadMedia } from "./api.js";

let siteData = null;
let pendingConfirm = null;
let pendingConfirmTimer = null;

const tokenInput = document.querySelector("#tokenInput");
const loginScreen = document.querySelector("#loginScreen");
const adminApp = document.querySelector("#adminApp");
const loginForm = document.querySelector("#loginForm");
const loginPassword = document.querySelector("#loginPassword");
const loginStatus = document.querySelector("#loginStatus");
const logoutBtn = document.querySelector("#logoutBtn");
const statusEl = document.querySelector("#status");
const loadBtn = document.querySelector("#loadBtn");
const saveBtn = document.querySelector("#saveBtn");
const roomGameSelect = document.querySelector("#roomGameSelect");
const createRoomBtn = document.querySelector("#createRoomBtn");
const refreshRoomsBtn = document.querySelector("#refreshRoomsBtn");
const createdRoom = document.querySelector("#createdRoom");

const lists = {
  banners: document.querySelector("#bannersList"),
  announcements: document.querySelector("#announcementsList"),
  categories: document.querySelector("#categoriesList"),
  prices: document.querySelector("#pricesList"),
  companions: document.querySelector("#companionsList"),
  games: document.querySelector("#gamesList"),
  activeRooms: document.querySelector("#activeRoomsList"),
  endedRooms: document.querySelector("#endedRoomsList"),
  rights: document.querySelector("#rightsList")
};

tokenInput.value = localStorage.getItem("xuejin-admin-token") || "";

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

function resetConfirmButtons() {
  clearTimeout(pendingConfirmTimer);
  pendingConfirm = null;
  loadBtn.textContent = "重新读取";
  saveBtn.textContent = "保存数据";
  loadBtn.classList.remove("danger");
  saveBtn.classList.remove("danger");
}

function confirmBefore(button, key, confirmText, message, action) {
  if (pendingConfirm === key) {
    resetConfirmButtons();
    action();
    return;
  }

  resetConfirmButtons();
  pendingConfirm = key;
  button.textContent = confirmText;
  button.classList.add("danger");
  setStatus(message, "error");
  pendingConfirmTimer = setTimeout(() => {
    resetConfirmButtons();
    setStatus("确认已取消。", "");
  }, 4500);
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function field(label, value, path, options = {}) {
  const tag = options.textarea ? "textarea" : "input";
  const rows = options.textarea ? ` rows="${options.rows || 3}"` : "";
  const type = options.type || "text";
  const input = tag === "textarea"
    ? `<textarea data-path="${escapeAttr(path)}"${rows}>${escapeText(value)}</textarea>`
    : `<input data-path="${escapeAttr(path)}" type="${type}" value="${escapeAttr(value)}" />`;
  return `<label class="field ${options.full ? "full" : ""}">${label}${input}</label>`;
}

function mediaPreview(url) {
  if (!url) return "";
  const cleanUrl = escapeAttr(url);
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) {
    return `<video class="media-preview" src="${cleanUrl}" controls muted></video>`;
  }
  return `<img class="media-preview" src="${cleanUrl}" alt="">`;
}

function mediaField(label, value, path, accept, options = {}) {
  return `
    <div class="field media-field ${options.full === false ? "" : "full"}">
      <span>${label}</span>
      <div class="media-row">
        <input data-path="${escapeAttr(path)}" type="text" value="${escapeAttr(value)}" placeholder="可手动填写地址，也可上传文件" />
        <label class="upload-btn">
          上传
          <input data-upload-path="${escapeAttr(path)}" type="file" accept="${escapeAttr(accept)}" />
        </label>
      </div>
      ${mediaPreview(value)}
    </div>
  `;
}

function tagsToText(tags) {
  return Array.isArray(tags) ? tags.join("，") : "";
}

function textToTags(text) {
  return String(text || "")
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnnouncement(item = {}) {
  return {
    title: item.title || "",
    date: item.date || "",
    summary: item.summary || "",
    imageUrl: item.imageUrl || "",
    details: Array.isArray(item.details) ? item.details.map((detail) => ({
      text: detail.text || "",
      strong: Boolean(detail.strong)
    })) : []
  };
}

function normalizeRight(item) {
  if (typeof item === "string") {
    return { title: item, body: "这里可以填写完整须知内容。", imageUrl: "", fileUrl: "" };
  }
  return {
    title: item?.title || "",
    body: item?.body || "",
    imageUrl: item?.imageUrl || "",
    fileUrl: item?.fileUrl || ""
  };
}

function ensureShape(data) {
  const announcements = Array.isArray(data.announcements)
    ? data.announcements
    : (data.announcement ? [data.announcement] : []);

  return {
    brand: {
      siteName: data.brand?.siteName || "雪烬电竞",
      tagline: data.brand?.tagline || "霜火集结，开局即燃",
      logoUrl: data.brand?.logoUrl || "./assets/xuejin-logo.jpg",
      contactHours: data.brand?.contactHours || "营业时间: 待填写",
      contactChannel: data.brand?.contactChannel || "联系渠道: 待填写",
      footerText: data.brand?.footerText || "雪烬电竞 · 独立门户"
    },
    banners: (data.banners || []).map((item) => ({
      kicker: item.kicker || "",
      title: item.title || "",
      desc: item.desc || "",
      tag: item.tag || ""
    })),
    announcements: announcements.map(normalizeAnnouncement),
    categories: data.categories || [],
    prices: (data.prices || []).map((item) => ({
      cat: item.cat || "",
      name: item.name || "",
      price: item.price || "",
      guarantee: item.guarantee || "",
      featured: Boolean(item.featured),
      imageUrl: item.imageUrl || "",
      tags: item.tags || [],
      note: item.note || ""
    })),
    companions: (data.companions || []).map((item) => ({
      name: item.name || "",
      gender: item.gender || "",
      category: item.category || "",
      level: item.level || "",
      orders: item.orders || "",
      imageUrl: item.imageUrl || "",
      videoUrl: item.videoUrl || "",
      tags: item.tags || []
    })),
    games: (data.games || []).map((item) => ({
      name: item.name || "",
      desc: item.desc || "",
      imageUrl: item.imageUrl || "",
      href: item.href || ""
    })),
    rights: (data.rights || []).map(normalizeRight),
    about: data.about || ""
  };
}

function renderAll() {
  siteData = ensureShape(siteData || {});
  document.querySelector("#brandNameInput").value = siteData.brand.siteName;
  document.querySelector("#brandTaglineInput").value = siteData.brand.tagline;
  document.querySelector("#brandLogoInput").value = siteData.brand.logoUrl;
  document.querySelector("#contactHoursInput").value = siteData.brand.contactHours;
  document.querySelector("#contactChannelInput").value = siteData.brand.contactChannel;
  document.querySelector("#footerTextInput").value = siteData.brand.footerText;
  document.querySelector("#aboutInput").value = siteData.about;
  renderBanners();
  renderAnnouncements();
  renderCategories();
  renderPrices();
  renderCompanions();
  renderGames();
  renderRoomGameOptions();
  renderRights();
}

function renderBanners() {
  lists.banners.innerHTML = siteData.banners.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="banner">
      <div class="item-head"><strong>轮播 ${index + 1}</strong><button class="danger" type="button" data-remove="banner" data-index="${index}">删除</button></div>
      <div class="grid">
        ${field("小标题", item.kicker, `banners.${index}.kicker`)}
        ${field("标签", item.tag, `banners.${index}.tag`)}
        ${field("主标题", item.title, `banners.${index}.title`, { full: true })}
        ${field("描述", item.desc, `banners.${index}.desc`, { textarea: true, full: true })}
      </div>
    </div>
  `).join("");
}

function renderAnnouncements() {
  lists.announcements.innerHTML = siteData.announcements.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="announcement">
      <div class="item-head">
        <strong>公告 ${index + 1}</strong>
        <div class="button-row">
          <button type="button" data-add-detail="${index}">添加详情段落</button>
          <button class="danger" type="button" data-remove="announcement" data-index="${index}">删除</button>
        </div>
      </div>
      <div class="grid">
        ${field("公告标题", item.title, `announcements.${index}.title`)}
        ${field("日期", item.date, `announcements.${index}.date`, { type: "date" })}
        ${mediaField("公告左侧图片", item.imageUrl, `announcements.${index}.imageUrl`, "image/*")}
        ${field("公告摘要", item.summary, `announcements.${index}.summary`, { textarea: true, full: true })}
      </div>
      <h3>公告详情</h3>
      <div class="list compact">
        ${item.details.map((detail, detailIndex) => `
          <div class="item-card nested">
            <div class="item-head">
              <strong>段落 ${detailIndex + 1}</strong>
              <button class="danger" type="button" data-remove-detail="${index}" data-detail-index="${detailIndex}">删除</button>
            </div>
            <div class="grid">
              ${field("内容", detail.text, `announcements.${index}.details.${detailIndex}.text`, { textarea: true, full: true })}
              <label class="inline-check"><input data-path="announcements.${index}.details.${detailIndex}.strong" type="checkbox" ${detail.strong ? "checked" : ""}>重点显示</label>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function renderCategories() {
  lists.categories.innerHTML = siteData.categories.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="category">
      <div class="item-head"><strong>${escapeText(item.name || `分类 ${index + 1}`)}</strong><button class="danger" type="button" data-remove="category" data-index="${index}">删除</button></div>
      <div class="grid">
        ${field("分类 ID", item.id, `categories.${index}.id`)}
        ${field("分类名称", item.name, `categories.${index}.name`)}
        ${field("颜色", item.color, `categories.${index}.color`, { type: "color" })}
      </div>
    </div>
  `).join("");
}

function categoryOptions(selected) {
  return siteData.categories.map((cat) => `<option value="${escapeAttr(cat.id)}" ${cat.id === selected ? "selected" : ""}>${escapeText(cat.name)} (${escapeText(cat.id)})</option>`).join("");
}

function renderPrices() {
  lists.prices.innerHTML = siteData.prices.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="price">
      <div class="item-head"><strong>${escapeText(item.name || `项目 ${index + 1}`)}</strong><button class="danger" type="button" data-remove="price" data-index="${index}">删除</button></div>
      <div class="grid">
        <label class="field">所属分类<select data-path="prices.${index}.cat">${categoryOptions(item.cat)}</select></label>
        ${field("套餐名称", item.name, `prices.${index}.name`)}
        ${field("价格", item.price, `prices.${index}.price`)}
        ${field("保底/说明", item.guarantee, `prices.${index}.guarantee`)}
        ${mediaField("套餐头图", item.imageUrl, `prices.${index}.imageUrl`, "image/*")}
        ${field("标签，用逗号分隔", tagsToText(item.tags), `prices.${index}.tagsText`, { full: true })}
        ${field("备注", item.note, `prices.${index}.note`, { textarea: true, full: true })}
        <label class="inline-check"><input data-path="prices.${index}.featured" type="checkbox" ${item.featured ? "checked" : ""}>推荐</label>
      </div>
    </div>
  `).join("");
}

function renderCompanions() {
  lists.companions.innerHTML = siteData.companions.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="companion">
      <div class="item-head"><strong>${escapeText(item.name || `音卡 ${index + 1}`)}</strong><button class="danger" type="button" data-remove="companion" data-index="${index}">删除</button></div>
      <div class="grid">
        ${field("名称", item.name, `companions.${index}.name`)}
        ${field("性别符号", item.gender, `companions.${index}.gender`)}
        ${field("分类", item.category, `companions.${index}.category`)}
        ${field("等级/说明", item.level, `companions.${index}.level`)}
        ${field("成交数", item.orders, `companions.${index}.orders`)}
        ${field("标签，用逗号分隔", tagsToText(item.tags), `companions.${index}.tagsText`)}
        ${mediaField("页面展示图片", item.imageUrl, `companions.${index}.imageUrl`, "image/*")}
        ${mediaField("点击后播放视频", item.videoUrl, `companions.${index}.videoUrl`, "video/*")}
      </div>
    </div>
  `).join("");
}

function renderGames() {
  lists.games.innerHTML = siteData.games.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="game">
      <div class="item-head"><strong>${escapeText(item.name || `游戏 ${index + 1}`)}</strong><button class="danger" type="button" data-remove="game" data-index="${index}">删除</button></div>
      <div class="grid">
        ${field("游戏名称", item.name, `games.${index}.name`)}
        ${field("打开链接，留空就是占位提示", item.href || "", `games.${index}.href`)}
        ${mediaField("展示图片", item.imageUrl, `games.${index}.imageUrl`, "image/*")}
        ${field("描述", item.desc, `games.${index}.desc`, { textarea: true, full: true })}
      </div>
    </div>
  `).join("");
}

function renderRoomGameOptions() {
  const playableGames = siteData.games.filter((item) => item.href);
  if (!playableGames.length) {
    roomGameSelect.innerHTML = `<option value="">暂无可创建房间的游戏，请先给趣味单游戏填写页面链接</option>`;
    return;
  }
  roomGameSelect.innerHTML = playableGames.map((item, index) => `
    <option value="${index}">${escapeText(item.name)} - ${escapeText(item.href)}</option>
  `).join("");
}

function renderRights() {
  lists.rights.innerHTML = siteData.rights.map((item, index) => `
    <div class="item-card" data-index="${index}" data-kind="right">
      <div class="item-head"><strong>${escapeText(item.title || `须知 ${index + 1}`)}</strong><button class="danger" type="button" data-remove="right" data-index="${index}">删除</button></div>
      <div class="grid">
        ${field("须知标题", item.title, `rights.${index}.title`, { full: true })}
        ${field("须知内容", item.body, `rights.${index}.body`, { textarea: true, rows: 5, full: true })}
        ${mediaField("展示图片", item.imageUrl, `rights.${index}.imageUrl`, "image/*")}
        ${mediaField("内容文件/视频", item.fileUrl, `rights.${index}.fileUrl`, "image/*,video/*")}
      </div>
    </div>
  `).join("");
}

function setByPath(path, value) {
  const parts = path.split(".");
  let target = siteData;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]];
  }
  target[parts.at(-1)] = value;
}

function collectForm() {
  siteData.brand.siteName = document.querySelector("#brandNameInput").value;
  siteData.brand.tagline = document.querySelector("#brandTaglineInput").value;
  siteData.brand.logoUrl = document.querySelector("#brandLogoInput").value || "./assets/xuejin-logo.jpg";
  siteData.brand.contactHours = document.querySelector("#contactHoursInput").value;
  siteData.brand.contactChannel = document.querySelector("#contactChannelInput").value;
  siteData.brand.footerText = document.querySelector("#footerTextInput").value;
  siteData.about = document.querySelector("#aboutInput").value;

  document.querySelectorAll("[data-path]").forEach((input) => {
    const path = input.dataset.path;
    if (path.endsWith(".tagsText")) return;
    const value = input.type === "checkbox" ? input.checked : input.value;
    setByPath(path, value);
  });

  siteData.prices.forEach((item, index) => {
    item.tags = textToTags(document.querySelector(`[data-path="prices.${index}.tagsText"]`)?.value || "");
    delete item.tagsText;
  });
  siteData.companions.forEach((item, index) => {
    item.tags = textToTags(document.querySelector(`[data-path="companions.${index}.tagsText"]`)?.value || "");
    delete item.tagsText;
  });
}

function addItem(type) {
  collectForm();
  const firstCat = siteData.categories[0]?.id || "mobile";
  const additions = {
    banner: () => siteData.banners.push({ kicker: "XUEJIN CLUB", title: "新轮播", desc: "请输入描述", tag: "新标签" }),
    announcement: () => siteData.announcements.push({ title: "新公告", date: new Date().toISOString().slice(0, 10), summary: "请输入公告摘要", imageUrl: "", details: [] }),
    category: () => siteData.categories.push({ id: uid("cat"), name: "新分类", color: "#46d9ff" }),
    price: () => siteData.prices.push({ cat: firstCat, name: "新套餐", price: "待定", guarantee: "内容待填充", featured: false, imageUrl: "", tags: [], note: "" }),
    companion: () => siteData.companions.push({ name: "新音卡", gender: "♀", category: "三角洲行动", level: "资料待填", orders: "-", imageUrl: "", videoUrl: "", tags: [] }),
    game: () => siteData.games.push({ name: "新游戏", desc: "试玩入口已预留，后续填充游戏内容。", imageUrl: "", href: "" }),
    right: () => siteData.rights.push({ title: "新须知", body: "请输入须知内容。", imageUrl: "", fileUrl: "" })
  };
  additions[type]?.();
  renderAll();
}

function removeItem(type, index) {
  collectForm();
  const maps = {
    banner: siteData.banners,
    announcement: siteData.announcements,
    category: siteData.categories,
    price: siteData.prices,
    companion: siteData.companions,
    game: siteData.games,
    right: siteData.rights
  };
  maps[type]?.splice(index, 1);
  renderAll();
}

function addDetail(announcementIndex) {
  collectForm();
  siteData.announcements[announcementIndex].details.push({ text: "新详情段落", strong: false });
  renderAll();
}

function removeDetail(announcementIndex, detailIndex) {
  collectForm();
  siteData.announcements[announcementIndex].details.splice(detailIndex, 1);
  renderAll();
}

async function uploadForInput(input) {
  const file = input.files?.[0];
  if (!file) return;
  const token = tokenInput.value.trim();
  if (!token) {
    input.value = "";
    setStatus("请先登录后台再上传文件。", "error");
    return;
  }
  localStorage.setItem("xuejin-admin-token", token);
  setStatus("正在上传文件...");
  const payload = await uploadMedia(file, token);
  const path = input.dataset.uploadPath;
  const target = Array.from(document.querySelectorAll("[data-path]")).find((item) => item.dataset.path === path);
  if (target) target.value = payload.url;
  setByPath(path, payload.url);
  setStatus("上传成功，保存后前台会使用这个文件。", "ok");
  input.value = "";
}

async function load() {
  setStatus("正在读取内容...");
  siteData = ensureShape(await loadSiteData());
  renderAll();
  setStatus("内容已读取。", "ok");
}

async function save() {
  collectForm();
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("请先登录后台。", "error");
    return;
  }
  localStorage.setItem("xuejin-admin-token", token);
  setStatus("正在保存...");
  await saveSiteData(siteData, token);
  setStatus("已保存到数据库。", "ok");
}

async function login(token) {
  loginStatus.textContent = "正在登录...";
  loginStatus.className = "status";
  await checkAdmin(token);
  localStorage.setItem("xuejin-admin-token", token);
  tokenInput.value = token;
  loginScreen.hidden = true;
  adminApp.hidden = false;
  await load();
  await refreshRooms(true).catch(() => {});
}

function logout() {
  localStorage.removeItem("xuejin-admin-token");
  tokenInput.value = "";
  adminApp.hidden = true;
  loginScreen.hidden = false;
  loginPassword.value = "";
  loginStatus.textContent = "";
  loginPassword.focus();
}

function currentToken() {
  const token = tokenInput.value.trim();
  if (token) localStorage.setItem("xuejin-admin-token", token);
  return token;
}

function roomLink(url) {
  return new URL(url, window.location.origin).toString();
}

function roomCard(room) {
  return `
    <div class="item-card room-card ${room.settled ? "ended" : ""}">
      <div>
        <strong>${escapeText(room.code)} <span class="room-state">${room.settled ? "已结束" : "进行中"}</span></strong>
        <p>${escapeText(room.gameName)} · 更新 ${escapeText(room.updatedAt)}</p>
        <a href="${escapeAttr(room.url)}" target="_blank" rel="noopener">${escapeText(roomLink(room.url))}</a>
      </div>
      <div class="room-actions">
        <a href="./logs.html?room=${encodeURIComponent(room.code)}" target="_blank" rel="noopener">查看日志</a>
        <button class="danger" type="button" data-delete-room="${escapeAttr(room.code)}">删除房间</button>
      </div>
    </div>
  `;
}

function renderRooms(rooms) {
  const active = rooms.filter((room) => !room.settled);
  const ended = rooms.filter((room) => room.settled);
  lists.activeRooms.innerHTML = active.length
    ? active.map(roomCard).join("")
    : `<div class="empty-entry">暂无正在进行的房间。</div>`;
  lists.endedRooms.innerHTML = ended.length
    ? ended.map(roomCard).join("")
    : `<div class="empty-entry">暂无已结束的房间。</div>`;
}

async function refreshRooms(silent = false) {
  const token = currentToken();
  if (!token) {
    setStatus("请先登录后台。", "error");
    return;
  }
  const rooms = await listRooms(token);
  renderRooms(rooms);
  if (!silent) setStatus("房间列表已刷新。", "ok");
}

async function createRoomFromAdmin() {
  const token = currentToken();
  if (!token) {
    setStatus("请先登录后台。", "error");
    return;
  }
  collectForm();
  const playableGames = siteData.games.filter((item) => item.href);
  const game = playableGames[Number(roomGameSelect.value)];
  if (!game) {
    setStatus("请先选择有页面链接的趣味单游戏。", "error");
    return;
  }
  setStatus("正在创建房间...");
  const room = await createRoom({
    gameName: game.name,
    gameHref: game.href,
    gameSlug: game.href.split("/").pop().replace(".html", "")
  }, token);
  createdRoom.hidden = false;
  createdRoom.innerHTML = `
    <strong>房间号：${escapeText(room.code)}</strong>
    <span>进入链接：</span>
    <a href="${escapeAttr(room.url)}" target="_blank" rel="noopener">${escapeText(roomLink(room.url))}</a>
  `;
  await refreshRooms();
  setStatus("房间已创建。", "ok");
}

async function deleteRoomFromAdmin(code) {
  const token = currentToken();
  if (!token) {
    setStatus("请先登录后台。", "error");
    return;
  }
  const confirmed = window.confirm(`确定删除房间 ${code} 吗？房间会从列表移除，但数据库会保留操作日志。`);
  if (!confirmed) return;
  await deleteRoom(code, token);
  await refreshRooms(true);
  setStatus("房间已删除，操作日志已保留。", "ok");
}

document.querySelector("#adminTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-panel]");
  if (!button) return;
  document.querySelectorAll("[data-panel]").forEach((el) => el.classList.toggle("active", el === button));
  document.querySelectorAll("[data-panel-view]").forEach((el) => el.classList.toggle("active", el.dataset.panelView === button.dataset.panel));
  if (button.dataset.panel === "rooms") refreshRooms(true).catch(() => {});
});

document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  if (add) addItem(add.dataset.add);

  const remove = event.target.closest("[data-remove]");
  if (remove) removeItem(remove.dataset.remove, Number(remove.dataset.index));

  const addDetailButton = event.target.closest("[data-add-detail]");
  if (addDetailButton) addDetail(Number(addDetailButton.dataset.addDetail));

  const removeDetailButton = event.target.closest("[data-remove-detail]");
  if (removeDetailButton) removeDetail(Number(removeDetailButton.dataset.removeDetail), Number(removeDetailButton.dataset.detailIndex));

  const deleteRoomButton = event.target.closest("[data-delete-room]");
  if (deleteRoomButton) deleteRoomFromAdmin(deleteRoomButton.dataset.deleteRoom).catch((error) => setStatus(error.message, "error"));
});

document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-upload-path]");
  if (input) uploadForInput(input).catch((error) => setStatus(error.message, "error"));
});

loadBtn.addEventListener("click", () => confirmBefore(
  loadBtn,
  "load",
  "再次点击确认读取",
  "重新读取会丢弃当前未保存修改。请再点击一次确认。",
  () => load().catch((error) => setStatus(error.message, "error"))
));
saveBtn.addEventListener("click", () => confirmBefore(
  saveBtn,
  "save",
  "再次点击确认保存",
  "保存会覆盖前台当前内容。请再点击一次确认。",
  () => save().catch((error) => setStatus(error.message, "error"))
));
createRoomBtn.addEventListener("click", () => createRoomFromAdmin().catch((error) => setStatus(error.message, "error")));
refreshRoomsBtn.addEventListener("click", () => refreshRooms().catch((error) => setStatus(error.message, "error")));
logoutBtn.addEventListener("click", logout);
loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login(loginPassword.value.trim()).catch((error) => {
    loginStatus.textContent = error.message;
    loginStatus.className = "status error";
  });
});

if (tokenInput.value) {
  login(tokenInput.value).catch(() => logout());
} else {
  loginPassword.focus();
}
