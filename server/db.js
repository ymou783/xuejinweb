const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "xuejin.sqlite");
const schemaPath = path.join(__dirname, "schema.sql");
const defaultSitePath = path.join(rootDir, "public", "content", "default-site.json");

let db;

function openDatabase() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(fs.readFileSync(schemaPath, "utf8"));
  runMigrations();
  seedSiteContent();
  ensureMinesweeperGame();
  return db;
}

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function runMigrations() {
  if (!hasColumn("game_rooms", "settled")) {
    db.exec("ALTER TABLE game_rooms ADD COLUMN settled INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn("game_rooms", "deleted")) {
    db.exec("ALTER TABLE game_rooms ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
  }
}

function seedSiteContent() {
  const database = db;
  const exists = database.prepare("SELECT COUNT(*) AS count FROM site_content WHERE id = 1").get();
  if (exists.count > 0) return;
  const content = fs.readFileSync(defaultSitePath, "utf8");
  database
    .prepare("INSERT INTO site_content (id, content_json, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)")
    .run(content);
}

function ensureMinesweeperGame() {
  const row = db.prepare("SELECT content_json FROM site_content WHERE id = 1").get();
  if (!row) return;
  const content = JSON.parse(row.content_json);
  const games = Array.isArray(content.games) ? content.games : [];
  const game = {
    name: "三角洲扫雷大作战",
    desc: "老板先部署地雷，玩家按撤离带出结果获得翻格次数；找到全部地雷并完成基础保底后结单。",
    imageUrl: "./assets/minesweeper/game-concept-v2.png",
    href: "./games/minesweeper-battle.html"
  };
  const index = games.findIndex((item) => item?.href?.includes("minesweeper-battle") || item?.name?.includes("扫雷"));
  if (index >= 0 && games[index]?.href && games[index]?.imageUrl !== "./assets/minesweeper/game-concept.png") return;
  if (index >= 0) games[index] = { ...games[index], ...game };
  else games.unshift(game);
  content.games = games;
  db.prepare("UPDATE site_content SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
    .run(JSON.stringify(content, null, 2));
}

function getSiteContent() {
  const row = openDatabase().prepare("SELECT content_json FROM site_content WHERE id = 1").get();
  return JSON.parse(row.content_json);
}

function saveSiteContent(content) {
  const json = JSON.stringify(content, null, 2);
  openDatabase()
    .prepare("UPDATE site_content SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
    .run(json);
  return getSiteContent();
}

function createGameSession(gameSlug, state) {
  const id = randomUUID();
  openDatabase()
    .prepare("INSERT INTO game_sessions (id, game_slug, state_json, settled) VALUES (?, ?, ?, ?)")
    .run(id, gameSlug, JSON.stringify(state), state.settled ? 1 : 0);
  return getGameSession(id);
}

function getGameSession(id) {
  const row = openDatabase().prepare("SELECT * FROM game_sessions WHERE id = ?").get(id);
  if (!row) return null;
  return {
    id: row.id,
    gameSlug: row.game_slug,
    state: JSON.parse(row.state_json),
    settled: Boolean(row.settled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function updateGameSession(id, state) {
  const result = openDatabase()
    .prepare("UPDATE game_sessions SET state_json = ?, settled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(JSON.stringify(state), state.settled ? 1 : 0, id);
  if (result.changes === 0) return null;
  return getGameSession(id);
}

function addGameEvent(sessionId, eventType, payload) {
  openDatabase()
    .prepare("INSERT INTO game_events (session_id, event_type, payload_json) VALUES (?, ?, ?)")
    .run(sessionId, eventType, JSON.stringify(payload || {}));
}

function createRoom(room) {
  openDatabase()
    .prepare(`
      INSERT INTO game_rooms (code, game_slug, game_name, game_href, state_json, settled)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(room.code, room.gameSlug, room.gameName, room.gameHref, JSON.stringify(room.state || {}), room.state?.settled ? 1 : 0);
  addRoomEvent(room.code, "room_created", "后台", "创建房间", {
    gameSlug: room.gameSlug,
    gameName: room.gameName,
    gameHref: room.gameHref
  });
  return getRoom(room.code);
}

function getRoom(code) {
  const row = openDatabase().prepare("SELECT * FROM game_rooms WHERE code = ? AND deleted = 0").get(code);
  if (!row) return null;
  return {
    code: row.code,
    gameSlug: row.game_slug,
    gameName: row.game_name,
    gameHref: row.game_href,
    state: JSON.parse(row.state_json || "{}"),
    settled: Boolean(row.settled),
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function listRooms(options = {}) {
  const where = options.includeDeleted ? "" : "WHERE deleted = 0";
  return openDatabase()
    .prepare(`SELECT code, game_slug, game_name, game_href, settled, deleted, revision, created_at, updated_at FROM game_rooms ${where} ORDER BY created_at DESC`)
    .all()
    .map((row) => ({
      code: row.code,
      gameSlug: row.game_slug,
      gameName: row.game_name,
      gameHref: row.game_href,
      settled: Boolean(row.settled),
      deleted: Boolean(row.deleted),
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
}

function deleteRoom(code, actor = "后台") {
  const room = getRoom(code);
  if (!room) return null;
  addRoomEvent(code, "room_deleted", actor, "删除房间，保留日志", {
    gameSlug: room.gameSlug,
    gameName: room.gameName
  });
  openDatabase()
    .prepare("UPDATE game_rooms SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE code = ?")
    .run(code);
  return room;
}

function updateRoomState(code, state, event = {}) {
  const result = openDatabase()
    .prepare(`
      UPDATE game_rooms
      SET state_json = ?, settled = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `)
    .run(JSON.stringify(state || {}), state?.settled ? 1 : 0, code);
  if (result.changes === 0) return null;
  addRoomEvent(code, event.type || "state_update", event.actor || "", event.message || "更新房间数据", event.payload || {});
  return getRoom(code);
}

function addRoomEvent(roomCode, eventType, actor, message, payload) {
  openDatabase()
    .prepare("INSERT INTO room_events (room_code, event_type, actor, message, payload_json) VALUES (?, ?, ?, ?, ?)")
    .run(roomCode, eventType, actor || "", message || "", JSON.stringify(payload || {}));
}

function getRoomEvents(roomCode, limit = 200) {
  return openDatabase()
    .prepare("SELECT id, event_type, actor, message, payload_json, created_at FROM room_events WHERE room_code = ? ORDER BY id DESC LIMIT ?")
    .all(roomCode, limit)
    .map((row) => ({
      id: row.id,
      type: row.event_type,
      actor: row.actor,
      message: row.message,
      payload: JSON.parse(row.payload_json || "{}"),
      createdAt: row.created_at
    }));
}

module.exports = {
  openDatabase,
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
};
