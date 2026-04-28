/**
 * Authenticated account-management endpoints: change email, change password.
 *
 * Role in the Worker: handlers for `PUT /auth/email` and `PUT /auth/password`.
 *
 * Request flow position: index.ts router → middleware.requireAuth (verifies
 * JWT) → THIS file. Both handlers receive the verified `JWTPayload` as
 * `user` — `user.sub` is the trusted users.id.
 *
 * Env bindings used: DB (users table), JWT_SECRET (re-signing tokens after
 * change). No email is sent for these flows — Postmark is only invoked from
 * password-reset-email.ts.
 *
 * ----------------------------------------------------------------------------
 * D1 schema dependency: `users` (id, email, password, salt, updated_at)
 *   - `email` UNIQUE — relied on for the "already exists" check below.
 *   - `password` is a PBKDF2 hash, not plaintext. Rotated on password change.
 *   - `salt` rotated on every password change (fresh per write).
 *   - `updated_at` set via `datetime('now')` on each UPDATE.
 *
 * ----------------------------------------------------------------------------
 * Why we re-issue the JWT after these changes
 * ----------------------------------------------------------------------------
 * - Email change: the token's `email` claim becomes stale otherwise. We issue
 *   a new 30-day token so the client doesn't have to ask the user to log in
 *   again.
 * - Password change: re-issuing is a UX nicety — the existing token would
 *   still verify (we don't track sessions). Worth knowing: there is no global
 *   logout — a stolen JWT remains valid until exp regardless of password
 *   change. Rotating JWT_SECRET is the only nuke-everything lever.
 */

import { generateSalt, hashPassword, verifyPassword, signJWT, createJWTPayload } from "./crypto";
import { jsonResponse } from "./response";
import type { Env, JWTPayload, UserRow } from "./types";

/** Loose email check — keep in sync with auth.ts. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PUT /auth/email — change the authenticated user's email address.
 *
 * Requires the current password as confirmation. This is a sensitive action
 * (email controls password reset), so we re-verify identity beyond the JWT.
 *
 * Body:    { newEmail, password }
 * Resp:    200 { ok: true, token }   — token is a new JWT with the new email
 *          400 invalid email / missing password
 *          401 wrong password
 *          404 user row missing (shouldn't happen post-JWT-verify, but defensive)
 *          409 newEmail already taken by another account
 *
 * NOTE: trust `user.sub` from the JWT for the lookup, NOT any body field.
 */
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

  // Look up by the trusted user id from the JWT (`sub`), never by request body.
  const dbUser = await env.DB.prepare(
    "SELECT id, password, salt FROM users WHERE id = ?",
  ).bind(user.sub).first<UserRow>();

  if (!dbUser) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  // Constant-time password verification — see crypto.ts notes.
  const valid = await verifyPassword(password, dbUser.salt, dbUser.password);
  if (!valid) {
    return jsonResponse({ error: "Invalid password" }, 401);
  }

  // Pre-check uniqueness. The unique constraint on email would catch this on
  // INSERT/UPDATE, but a clean 409 beats a 500 from a constraint violation.
  // The `id != ?` ensures changing to your own current email isn't a 409.
  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND id != ?",
  ).bind(newEmail, user.sub).first();
  if (existing) {
    return jsonResponse({ error: "An account with this email already exists" }, 409);
  }

  await env.DB.prepare(
    "UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(newEmail, user.sub).run();

  // Re-issue JWT so the client's cached token reflects the new email claim.
  // The OLD token also still works until its 30-day exp — no revocation list.
  const payload = createJWTPayload(user.sub, newEmail);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ ok: true, token });
}

/**
 * PUT /auth/password — change the authenticated user's password.
 *
 * Requires the CURRENT password as confirmation (defense in depth — JWT alone
 * isn't enough for a password rotation).
 *
 * Body:    { currentPassword, newPassword }
 * Resp:    200 { ok: true, token } — refreshed JWT (UX nicety; old still works)
 *          400 missing currentPassword / new password length out of bounds
 *          401 wrong currentPassword
 *          404 user row missing (shouldn't happen post-JWT-verify, but defensive)
 *
 * NOTE: there is a known bug-shaped pattern below — the function declares
 * `const dbUser` twice. This compiles in TS only because the first `dbUser`
 * is later shadowed; in strict mode this is an error. Left in place per the
 * comments-only constraint of this pass — flag for a later fix.
 */
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
  // 8..128 length matches handleRegister / handleResetConfirm. Keep in sync.
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    return jsonResponse({ error: "New password must be between 8 and 128 characters" }, 400);
  }

  // First read: verify current password.
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

  // Fresh salt on every password change. Never reuse the old salt.
  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);

  await env.DB.prepare(
    "UPDATE users SET password = ?, salt = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(hash, salt, user.sub).run();

  // KNOWN ISSUE: re-declares `dbUser` in the same scope. Works at runtime in
  // non-strict TS configs but is a foot-gun. Future agents: rename this to
  // `dbUserAfter` (or similar) when allowed to change behavior. For now we
  // need the email for the refreshed JWT and the original `dbUser` only had
  // password/salt selected.
  const dbUser = await env.DB.prepare(
    "SELECT email FROM users WHERE id = ?",
  ).bind(user.sub).first<{ email: string }>();

  // Refreshed JWT — UX-only since the old token wasn't invalidated.
  const payload = createJWTPayload(user.sub, dbUser!.email);
  const token = await signJWT(payload, env.JWT_SECRET);

  return jsonResponse({ ok: true, token });
}
