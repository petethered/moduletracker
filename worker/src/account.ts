import { generateSalt, hashPassword, verifyPassword, signJWT, createJWTPayload } from "./crypto";
import { jsonResponse } from "./response";
import type { Env, JWTPayload, UserRow } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleChangeEmail(
  request: Request,
  user: JWTPayload,
  env: Env,
): Promise<Response> {
  const { newEmail, password } = await request.json<{ newEmail: string; password: string }>();

  if (!newEmail || !EMAIL_REGEX.test(newEmail)) {
    return jsonResponse({ error: "Invalid email format" }, 400);
  }
  if (!password) {
    return jsonResponse({ error: "Current password is required" }, 400);
  }

  const dbUser = await env.DB.prepare(
    "SELECT id, password, salt FROM users WHERE id = ?",
  ).bind(user.sub).first<UserRow>();

  if (!dbUser) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  const valid = await verifyPassword(password, dbUser.salt, dbUser.password);
  if (!valid) {
    return jsonResponse({ error: "Invalid password" }, 401);
  }

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND id != ?",
  ).bind(newEmail, user.sub).first();
  if (existing) {
    return jsonResponse({ error: "An account with this email already exists" }, 409);
  }

  await env.DB.prepare(
    "UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(newEmail, user.sub).run();

  const payload = createJWTPayload(user.sub, newEmail);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ ok: true, token });
}

export async function handleChangePassword(
  request: Request,
  user: JWTPayload,
  env: Env,
): Promise<Response> {
  const { currentPassword, newPassword } = await request.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  if (!currentPassword) {
    return jsonResponse({ error: "Current password is required" }, 400);
  }
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return jsonResponse({ error: "New password must be between 8 and 128 characters" }, 400);
  }

  const dbUser = await env.DB.prepare(
    "SELECT id, password, salt FROM users WHERE id = ?",
  ).bind(user.sub).first<UserRow>();

  if (!dbUser) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  const valid = await verifyPassword(currentPassword, dbUser.salt, dbUser.password);
  if (!valid) {
    return jsonResponse({ error: "Invalid current password" }, 401);
  }

  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);

  await env.DB.prepare(
    "UPDATE users SET password = ?, salt = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(hash, salt, user.sub).run();

  const dbUser = await env.DB.prepare(
    "SELECT email FROM users WHERE id = ?",
  ).bind(user.sub).first<{ email: string }>();

  const payload = createJWTPayload(user.sub, dbUser!.email);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ ok: true, token });
}
