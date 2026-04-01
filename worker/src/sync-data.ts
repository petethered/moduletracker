import { jsonResponse } from "./response";
import type { Env, JWTPayload } from "./types";

const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB

export async function handleGetSyncData(user: JWTPayload, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM users WHERE id = ?",
  ).bind(user.sub).first<{ data: string; updated_at: string }>();

  if (!row) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  return jsonResponse({
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
  });
}

export async function handlePutSyncData(request: Request, user: JWTPayload, env: Env): Promise<Response> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "Payload too large (max 1 MB)" }, 413);
  }

  const body = await request.json<{ data: unknown }>();
  const { data } = body;

  if (!data || typeof data !== "object") {
    return jsonResponse({ error: "Invalid data format" }, 400);
  }

  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.pulls)) {
    return jsonResponse({ error: "data.pulls must be an array" }, 400);
  }
  if (typeof d.moduleProgress !== "object" || d.moduleProgress === null || Array.isArray(d.moduleProgress)) {
    return jsonResponse({ error: "data.moduleProgress must be an object" }, 400);
  }

  const jsonStr = JSON.stringify(data);
  if (jsonStr.length > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "Payload too large (max 1 MB)" }, 413);
  }

  const result = await env.DB.prepare(
    "UPDATE users SET data = ?, updated_at = datetime('now') WHERE id = ? RETURNING updated_at",
  ).bind(jsonStr, user.sub).first<{ updated_at: string }>();

  return jsonResponse({ ok: true, updatedAt: result!.updated_at });
}
