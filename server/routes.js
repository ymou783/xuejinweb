const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  getSiteContent,
  saveSiteContent,
  createGameSession,
  getGameSession,
  updateGameSession,
  addGameEvent,
  createRoom,
  getRoom,
  listRooms,
  deleteRoom,
  updateRoomState,
  getRoomEvents
} = require("./db");

const publicDir = path.resolve(__dirname, "..", "public");
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const uploadDir = path.join(publicDir, "uploads");
const backupDir = path.join(rootDir, "backups");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

const allowedUploadExts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov"]);
const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readRawBody(req, limit = 120_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("上传文件过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function requireAdmin(req) {
  const token = process.env.ADMIN_TOKEN || "123456";
  const header = req.headers.authorization || "";
  return header === `Bearer ${token}`;
}

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function makeRoomCode() {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += roomAlphabet[Math.floor(Math.random() * roomAlphabet.length)];
  }
  return `XJ-${suffix}`;
}

function roomUrl(room) {
  let href = room.gameHref || "/";
  if (href.startsWith("./")) href = `/${href.slice(2)}`;
  else if (!href.startsWith("/") && !/^https?:\/\//i.test(href)) href = `/${href}`;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}room=${encodeURIComponent(room.code)}`;
}

function slugFromHref(href) {
  const base = path.basename(String(href || ""), ".html");
  return base || "game";
}

async function readMultipartFile(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("上传格式不正确");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const body = await readRawBody(req);
  let cursor = body.indexOf(boundary);
  const separator = Buffer.from("\r\n\r\n");

  while (cursor !== -1) {
    let partStart = cursor + boundary.length;
    if (body[partStart] === 45 && body[partStart + 1] === 45) break;
    if (body[partStart] === 13 && body[partStart + 1] === 10) partStart += 2;

    const headerEnd = body.indexOf(separator, partStart);
    if (headerEnd === -1) break;

    const nextBoundary = body.indexOf(boundary, headerEnd + separator.length);
    if (nextBoundary === -1) break;

    const headers = body.slice(partStart, headerEnd).toString("utf8");
    let dataEnd = nextBoundary;
    if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;

    const filenameMatch = headers.match(/filename="([^"]*)"/i);
    if (filenameMatch && filenameMatch[1]) {
      return {
        originalName: path.basename(filenameMatch[1]),
        contentType: (headers.match(/Content-Type:\s*([^\r\n]+)/i) || [])[1] || "application/octet-stream",
        buffer: body.slice(headerEnd + separator.length, dataEnd)
      };
    }

    cursor = nextBoundary;
  }

  throw new Error("没有找到上传文件");
}

async function saveUpload(req) {
  const file = await readMultipartFile(req);
  const ext = path.extname(file.originalName).toLowerCase();
  if (!allowedUploadExts.has(ext)) throw new Error("只支持常见图片和视频格式");
  fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}${ext}`;
  const target = path.join(uploadDir, fileName);
  fs.writeFileSync(target, file.buffer);
  return {
    url: `/uploads/${fileName}`,
    name: file.originalName,
    size: file.buffer.length,
    type: file.contentType
  };
}

function formatFileTime(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return total + directorySize(filePath);
    if (entry.isFile()) return total + fs.statSync(filePath).size;
    return total;
  }, 0);
}

function listMediaFiles() {
  if (!fs.existsSync(uploadDir)) return [];
  return fs.readdirSync(uploadDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(uploadDir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        name: entry.name,
        url: `/uploads/${entry.name}`,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        type: contentTypes[path.extname(entry.name).toLowerCase()] || "application/octet-stream"
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function deleteMediaFile(fileName) {
  const cleanName = path.basename(fileName);
  const target = path.join(uploadDir, cleanName);
  if (!target.startsWith(uploadDir) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  fs.unlinkSync(target);
  return true;
}

function listBackups() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(backupDir, entry.name);
      const manifestPath = path.join(dir, "manifest.json");
      const stat = fs.statSync(dir);
      let manifest = {};
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      }
      return {
        name: entry.name,
        path: dir,
        createdAt: manifest.createdAt || stat.mtime.toISOString(),
        size: directorySize(dir)
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function createBackup() {
  fs.mkdirSync(backupDir, { recursive: true });
  const name = formatFileTime(new Date());
  const targetDir = path.join(backupDir, name);
  fs.mkdirSync(targetDir, { recursive: true });

  const dbPath = process.env.DB_PATH || path.join(dataDir, "xuejin.sqlite");
  if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, path.join(targetDir, "xuejin.sqlite"));
  copyDirectory(uploadDir, path.join(targetDir, "uploads"));

  const manifest = {
    name,
    createdAt: new Date().toISOString(),
    includes: ["data/xuejin.sqlite", "public/uploads"]
  };
  fs.writeFileSync(path.join(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return listBackups().find((backup) => backup.name === name);
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/admin/check" && req.method === "GET") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "登录密码不正确" });
      return true;
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/site" && req.method === "GET") {
    sendJson(res, 200, getSiteContent());
    return true;
  }

  if (url.pathname === "/api/site" && req.method === "PUT") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    const content = await readJson(req);
    sendJson(res, 200, { ok: true, content: saveSiteContent(content) });
    return true;
  }

  if (url.pathname === "/api/uploads" && req.method === "POST") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    sendJson(res, 201, await saveUpload(req));
    return true;
  }

  if (url.pathname === "/api/media" && req.method === "GET") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    sendJson(res, 200, listMediaFiles());
    return true;
  }

  const mediaMatch = url.pathname.match(/^\/api\/media\/([^/]+)$/);
  if (mediaMatch && req.method === "DELETE") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    const ok = deleteMediaFile(mediaMatch[1]);
    if (!ok) sendJson(res, 404, { error: "文件不存在" });
    else sendJson(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/backups" && req.method === "GET") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    sendJson(res, 200, listBackups());
    return true;
  }

  if (url.pathname === "/api/backups" && req.method === "POST") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    sendJson(res, 201, createBackup());
    return true;
  }

  if (url.pathname === "/api/rooms" && req.method === "GET") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    const includeDeleted = url.searchParams.get("includeDeleted") === "1";
    sendJson(res, 200, listRooms({ includeDeleted }).map((room) => ({ ...room, url: roomUrl(room) })));
    return true;
  }

  if (url.pathname === "/api/rooms" && req.method === "POST") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    const payload = await readJson(req);
    const gameHref = payload.gameHref || payload.href || "";
    if (!gameHref) {
      sendJson(res, 400, { error: "请先选择有页面链接的趣味单游戏" });
      return true;
    }
    let code = makeRoomCode();
    while (getRoom(code)) code = makeRoomCode();
    const room = createRoom({
      code,
      gameSlug: payload.gameSlug || slugFromHref(gameHref),
      gameName: payload.gameName || payload.name || "趣味单游戏",
      gameHref,
      state: payload.state || {}
    });
    sendJson(res, 201, { ...room, url: roomUrl(room) });
    return true;
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && req.method === "GET") {
    const room = getRoom(normalizeRoomCode(roomMatch[1]));
    if (!room) sendJson(res, 404, { error: "房间不存在" });
    else sendJson(res, 200, { ...room, url: roomUrl(room) });
    return true;
  }

  if (roomMatch && req.method === "PUT") {
    const code = normalizeRoomCode(roomMatch[1]);
    if (!getRoom(code)) {
      sendJson(res, 404, { error: "房间不存在" });
      return true;
    }
    const payload = await readJson(req);
    const room = updateRoomState(code, payload.state || {}, {
      type: payload.eventType || "state_update",
      actor: payload.actor || "",
      message: payload.message || "更新房间数据",
      payload: payload.payload || {}
    });
    sendJson(res, 200, { ...room, url: roomUrl(room) });
    return true;
  }

  if (roomMatch && req.method === "DELETE") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    const deleted = deleteRoom(normalizeRoomCode(roomMatch[1]), "后台");
    if (!deleted) sendJson(res, 404, { error: "房间不存在" });
    else sendJson(res, 200, { ok: true, room: deleted });
    return true;
  }

  const roomEventsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/events$/);
  if (roomEventsMatch && req.method === "GET") {
    if (!requireAdmin(req)) {
      sendJson(res, 401, { error: "后台密码不正确" });
      return true;
    }
    const code = normalizeRoomCode(roomEventsMatch[1]);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 200)));
    sendJson(res, 200, getRoomEvents(code, limit));
    return true;
  }

  if (url.pathname === "/api/game-sessions" && req.method === "POST") {
    const payload = await readJson(req);
    const session = createGameSession(payload.gameSlug || "mo-hong-tianping", payload.state || {});
    sendJson(res, 201, session);
    return true;
  }

  const sessionMatch = url.pathname.match(/^\/api\/game-sessions\/([^/]+)$/);
  if (sessionMatch && req.method === "GET") {
    const session = getGameSession(sessionMatch[1]);
    if (!session) sendJson(res, 404, { error: "会话不存在" });
    else sendJson(res, 200, session);
    return true;
  }

  if (sessionMatch && req.method === "PUT") {
    const payload = await readJson(req);
    const session = updateGameSession(sessionMatch[1], payload.state || {});
    if (!session) sendJson(res, 404, { error: "会话不存在" });
    else sendJson(res, 200, session);
    return true;
  }

  const eventMatch = url.pathname.match(/^\/api\/game-sessions\/([^/]+)\/events$/);
  if (eventMatch && req.method === "POST") {
    const payload = await readJson(req);
    if (!getGameSession(eventMatch[1])) {
      sendJson(res, 404, { error: "会话不存在" });
      return true;
    }
    addGameEvent(eventMatch[1], payload.type || "event", payload.payload || {});
    sendJson(res, 201, { ok: true });
    return true;
  }

  return false;
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(res, 404, "Not Found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { error: "接口不存在" });
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "服务器错误" });
  }
}

module.exports = { handleRequest };
