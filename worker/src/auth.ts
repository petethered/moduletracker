import {
  generateSalt, hashPassword, verifyPassword,
  signJWT, createJWTPayload, generateResetToken, sha256,
} from "./crypto";
import { sendPasswordResetEmail } from "./password-reset-email";
import { jsonResponse } from "./response";
import type { Env, UserRow } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json<{ email: string; password: string }>();

  if (!email || !EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: "Invalid email format" }, 400);
  }
  if (!password || password.length < 8 || password.length > 128) {
    return jsonResponse({ error: "Password must be between 8 and 128 characters" }, 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return jsonResponse({ error: "Invalid email or password" }, 409);
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  const result = await env.DB.prepare(
    "INSERT INTO users (email, password, salt) VALUES (?, ?, ?) RETURNING id",
  ).bind(email, hash, salt).first<{ id: number }>();

  const payload = createJWTPayload(result!.id, email);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ token }, 201);
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json<{ email: string; password: string }>();

  if (!email || !password) {
    return jsonResponse({ error: "Email and password are required" }, 400);
  }

  const user = await env.DB.prepare(
    "SELECT id, email, password, salt FROM users WHERE email = ?",
  ).bind(email).first<UserRow>();

  if (!user) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.salt, user.password);
  if (!valid) {
    return jsonResponse({ error: "Invalid email or password" }, 401);
  }

  const payload = createJWTPayload(user.id, user.email);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ token });
}

export async function handleResetRequest(request: Request, env: Env): Promise<Response> {
  const { email } = await request.json<{ email: string }>();

  // Always return success to avoid leaking whether the email exists
  const successResponse = jsonResponse({ ok: true });

  if (!email || !EMAIL_REGEX.test(email)) {
    return successResponse;
  }

  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ?",
  ).bind(email).first<{ id: number }>();

  if (!user) return successResponse;

  // Rate limit: max 3 resets per user per hour
  const recentCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM password_reset_tokens WHERE user_id = ? AND created_at > datetime('now', '-1 hour')",
  ).bind(user.id).first<{ count: number }>();

  if (recentCount && recentCount.count >= 3) {
    return successResponse;
  }

  const token = generateResetToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  ).bind(user.id, tokenHash, expiresAt).run();

  try {
    await sendPasswordResetEmail(env, email, token);
  } catch {
    // Log but don't fail the request
  }

  return successResponse;
}

export async function handleResetConfirm(request: Request, env: Env): Promise<Response> {
  const { token, newPassword } = await request.json<{ token: string; newPassword: string }>();

  if (!token) {
    return jsonResponse({ error: "Reset token is required" }, 400);
  }
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return jsonResponse({ error: "Password must be between 8 and 128 characters" }, 400);
  }

  const tokenHash = await sha256(token);
  const resetRow = await env.DB.prepare(
    "SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?",
  ).bind(tokenHash).first<{ id: number; user_id: number; expires_at: string; used: number }>();

  if (!resetRow || resetRow.used) {
    return jsonResponse({ error: "Invalid or already used reset token" }, 400);
  }

  if (new Date(resetRow.expires_at) < new Date()) {
    return jsonResponse({ error: "Reset token has expired" }, 400);
  }

  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);

  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password = ?, salt = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, salt, resetRow.user_id),
    env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?")
      .bind(resetRow.user_id),
  ]);

  const user = await env.DB.prepare(
    "SELECT id, email FROM users WHERE id = ?",
  ).bind(resetRow.user_id).first<{ id: number; email: string }>();

  const payload = createJWTPayload(user!.id, user!.email);
  const jwt = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ token: jwt });
}
