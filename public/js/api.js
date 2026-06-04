export async function loadSiteData() {
  try {
    const response = await fetch("/api/site", { headers: { Accept: "application/json" } });
    if (response.ok) return await response.json();
  } catch (_) {
    // Static preview fallback.
  }

  const fallback = await fetch("/content/default-site.json", { headers: { Accept: "application/json" } });
  if (!fallback.ok) throw new Error("无法加载网站内容");
  return fallback.json();
}

export async function saveSiteData(data, token) {
  const response = await fetch("/api/site", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "保存失败");
  return payload;
}

export async function uploadMedia(file, token) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "上传失败");
  return payload;
}

export async function listRooms(token, options = {}) {
  const query = options.includeDeleted ? "?includeDeleted=1" : "";
  const response = await fetch(`/api/rooms${query}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "读取房间失败");
  return payload;
}

export async function createRoom(data, token) {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "创建房间失败");
  return payload;
}

export async function loadRoomEvents(code, token) {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/events`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "读取日志失败");
  return payload;
}

export async function deleteRoom(code, token) {
  const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "删除房间失败");
  return payload;
}

export async function checkAdmin(token) {
  const response = await fetch("/api/admin/check", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "登录失败");
  return payload;
}
