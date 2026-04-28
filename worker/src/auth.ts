/**
 * Public auth endpoints: register, login, password-reset request/confirm.
 *
 * Role in the Worker: handlers for the four `/auth/*` POST routes that do NOT
 * require an existing session.
 *
 * Request flow position: index.ts router → THIS file (no middleware — these
 * are public endpoints). Calls into crypto.ts for hashing/JWT and into
 * password-reset-email.ts for outbound mail.
 *
 * Env bindings used: DB (users + password_reset_tokens tables), JWT_SECRET
 * (signing tokens), POSTMARK_API_KEY + FROM_EMAIL (via password-reset-email).
 *
 * ----------------------------------------------------------------------------
 * D1 schema dependencies
 * ----------------------------------------------------------------------------
 *
 * `users` table (referenced columns):
 *   id           INTEGER PRIMARY KEY AUTOINCREMENT
 *   email        TEXT UNIQUE         -- enforces single-account-per-email
 *   password     TEXT                -- PBKDF2 hash, base64 (NOT plaintext)
 *   salt         TEXT                -- per-user random salt, base64
 *   updated_at   TEXT                -- bumped on password change
 *
 * `password_reset_tokens` table:
 *   id           INTEGER PRIMARY KEY AUTOINCREMENT
 *   user_id      INTEGER REFERENCES users(id)
 *   token        TEXT                -- SHA-256(token) hex; NEVER the raw token
 *   expires_at   TEXT                -- ISO-8601, 1 hour after creation
 *   used         INTEGER             -- 0 = unused, 1 = consumed
 *   created_at   TEXT                -- defaulted by D1 (used by rate limit)
 *
 * ----------------------------------------------------------------------------
 * SECURITY notes specific to this file
 * ----------------------------------------------------------------------------
 *
 * - Registration returns 409 with a generic "Invalid email or password" — we
 *   do not say "already registered". This trades a tiny UX cost for not
 *   revealing whether a given email has an account (enumeration protection).
 *   Note the status code (409) DOES leak this — improvement candidate, but
 *   the message is intentionally generic.
 *
 * - Login returns the same generic message regardless of "user not found" vs
 *   "wrong password" — both 401 with the same body.
 *
 * - Reset-request ALWAYS returns 200 { ok: true } regardless of whether the
 *   email exists, the rate limit was hit, or the email send failed. This is
 *   the standard anti-enumeration pattern.
 *
 * - Reset tokens are hashed before storage (sha256). The plaintext only ever
 *   exists in transit (in the email link).
 *
 * - Reset rate limit: 3 attempts per user per hour, enforced by counting rows
 *   in password_reset_tokens. Cheap throttle to slow abuse + reduce email cost.
 */

import {
  generateSalt, hashPassword, verifyPassword,
  signJWT, createJWTPayload, generateResetToken, sha256,
} from "./crypto";
import { sendPasswordResetEmail } from "./password-reset-email";
import { jsonResponse } from "./response";
import type { Env, UserRow } from "./types";

/**
 * Loose RFC-5322-ish email regex. We are NOT trying to validate per-spec —
 * just rejecting obvious garbage. Real validation = sending the email.
 * Same regex used in account.ts; keep them in sync if changed.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /auth/register
 *
 * Creates a new user, hashes their password (PBKDF2 + fresh salt), inserts
 * into D1, and returns a 30-day JWT so the client can immediately log in.
 *
 * Status codes:
 *   201 — created, body { token }
 *   400 — invalid email or password length
 *   409 — email already registered (generic message; see SECURITY notes)
 */
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json<{ email: string; password: string }>();

  if (!email || !EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: "Invalid email format" }, 400);
  }
  // 8..128 length: lower bound is policy, upper bound prevents DoS via huge
  // PBKDF2 input. Keep in sync with handleResetConfirm + handleChangePassword.
  if (!password || password.length < 8 || password.length > 128) {
    return jsonResponse({ error: "Password must be between 8 and 128 characters" }, 400);
  }

  // Pre-check for an existing email so we can return a clean 409. There is a
  // race here vs the unique constraint — D1 would also reject the INSERT, but
  // the user-facing error would be uglier. Acceptable tradeoff.
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    // Intentionally generic message — see SECURITY notes (enumeration).
    return jsonResponse({ error: "Invalid email or password" }, 409);
  }

  // Fresh salt per user. NEVER reuse across users.
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  // RETURNING id avoids a second round-trip to read the new row's id.
  const result = await env.DB.prepare(
    "INSERT INTO users (email, password, salt) VALUES (?, ?, ?) RETURNING id",
  ).bind(email, hash, salt).first<{ id: number }>();

  // Auto-login after registration: issue the JWT immediately.
  const payload = createJWTPayload(result!.id, email);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ token }, 201);
}

/**
 * POST /auth/login
 *
 * Verifies email+password (constant-time) and returns a 30-day JWT.
 *
 * Status codes:
 *   200 — body { token }
 *   400 — missing email/password in body
 *   401 — bad credentials (same message for "no such user" vs "wrong password")
 */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json<{ email: string; password: string }>();

  if (!email || !password) {
    return jsonResponse({ error: "Email and password are required" }, 400);
  }

  // Only fetch the columns we need for verification. Avoids loading `data`
  // (which can be ~1MB) on every login.
  const user = await env.DB.prepare(
    "SELECT id, email, password, salt FROM users WHERE email = ?",
  ).bind(email).first<UserRow>();

  if (!user) {
    // Same response shape as wrong-password to avoid enumeration.
    // Note: the *timing* of this branch differs (no PBKDF2 work done) which
    // is a minor enumeration vector. Acceptable for now.
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

/**
 * POST /auth/reset-request
 *
 * Begins a password-reset flow: generates a one-time token, stores its hash
 * in D1, and emails the plaintext to the user via Postmark.
 *
 * ALWAYS returns 200 { ok: true } regardless of:
 *   - invalid email format
 *   - email not registered
 *   - rate limit hit (3/hour)
 *   - Postmark send failure
 * → prevents account enumeration and avoids leaking infra status. Internal
 * failures are silently swallowed. If Postmark is broken we have no way to
 * surface that here — monitor via Cloudflare logs / Postmark dashboard.
 *
 * Token TTL: 1 hour. Token format: 32 random bytes hex (see generateResetToken).
 * Stored as sha256(token), so DB compromise doesn't leak active reset URLs.
 */
export async function handleResetRequest(request: Request, env: Env): Promise<Response> {
  const { email } = await request.json<{ email: string }>();

  // Always return success to avoid leaking whether the email exists.
  // Reused below in every early-return so behavior is uniform.
  const successResponse = jsonResponse({ ok: true });

  if (!email || !EMAIL_REGEX.test(email)) {
    return successResponse;
  }

  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ?",
  ).bind(email).first<{ id: number }>();

  if (!user) return successResponse;

  // Rate limit: max 3 resets per user per hour. Counts ALL tokens in the last
  // hour (used or unused) — simplest possible throttle. If a user hits this,
  // they wait an hour OR we manually clear via wrangler.
  const recentCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM password_reset_tokens WHERE user_id = ? AND created_at > datetime('now', '-1 hour')",
  ).bind(user.id).first<{ count: number }>();

  if (recentCount && recentCount.count >= 3) {
    // Silently drop — same response shape as success.
    return successResponse;
  }

  // Plaintext token goes in the email URL; only its sha256 is stored.
  const token = generateResetToken();
  const tokenHash = await sha256(token);
  // 1 hour TTL. ISO-8601 string for D1 — comparable via `datetime()`.
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  ).bind(user.id, tokenHash, expiresAt).run();

  try {
    await sendPasswordResetEmail(env, email, token);
  } catch {
    // Log but don't fail the request — user-visible response stays uniform.
    // The token row still exists so the user could complete the flow if they
    // somehow got the link, but realistically a Postmark failure means the
    // user retries shortly.
  }

  return successResponse;
}

/**
 * POST /auth/reset-confirm
 *
 * Consumes a password-reset token: validates it, sets a new password (with a
 * fresh salt), invalidates ALL outstanding reset tokens for that user, and
 * returns a fresh JWT so the user is auto-logged-in.
 *
 * Status codes:
 *   200 — body { token } (the new JWT)
 *   400 — missing/invalid/expired/used token, or bad new password
 *
 * Token validation:
 *   1. Token must be present.
 *   2. Stored row must exist (lookup is by sha256(token), so a leaked DB
 *      doesn't help an attacker — they'd need the plaintext from the email).
 *   3. `used` must be 0.
 *   4. `expires_at` must be in the future.
 *
 * Side effects (atomic via D1 batch):
 *   - users: password + salt rotated, updated_at bumped.
 *   - password_reset_tokens: ALL rows for this user marked `used = 1`. This
 *     invalidates any other outstanding reset links — a security measure,
 *     since the user just demonstrated control of their email.
 */
export async function handleResetConfirm(request: Request, env: Env): Promise<Response> {
  const { token, newPassword } = await request.json<{ token: string; newPassword: string }>();

  if (!token) {
    return jsonResponse({ error: "Reset token is required" }, 400);
  }
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return jsonResponse({ error: "Password must be between 8 and 128 characters" }, 400);
  }

  // We stored sha256(token); look up by the same hash.
  const tokenHash = await sha256(token);
  const resetRow = await env.DB.prepare(
    "SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?",
  ).bind(tokenHash).first<{ id: number; user_id: number; expires_at: string; used: number }>();

  // Combine "not found" and "already used" into one error to avoid leaking
  // which case it is (an attacker probing tokens learns less).
  if (!resetRow || resetRow.used) {
    return jsonResponse({ error: "Invalid or already used reset token" }, 400);
  }

  if (new Date(resetRow.expires_at) < new Date()) {
    return jsonResponse({ error: "Reset token has expired" }, 400);
  }

  // Fresh salt on every password change.
  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);

  // Batch the password update + token invalidation so we either do both or
  // neither. D1 batch is transactional. If we updated the password without
  // burning the tokens, an attacker with another live token could reset again.
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password = ?, salt = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, salt, resetRow.user_id),
    // Invalidate ALL of this user's reset tokens, not just this one.
    env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?")
      .bind(resetRow.user_id),
  ]);

  // Re-fetch the user to issue a JWT — we need the email for the payload and
  // we don't fully trust the stored email is unchanged since the reset row
  // was created (paranoid, but cheap).
  const user = await env.DB.prepare(
    "SELECT id, email FROM users WHERE id = ?",
  ).bind(resetRow.user_id).first<{ id: number; email: string }>();

  const payload = createJWTPayload(user!.id, user!.email);
  const jwt = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ token: jwt });
}
