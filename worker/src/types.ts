/**
 * Shared TypeScript types for the ModuleTracker Cloudflare Worker.
 *
 * Role in the Worker: foundational type module — imported by every other file.
 * No runtime code; pure type declarations.
 *
 * Request flow position: not in the request flow itself — these types describe
 * the shapes that flow through router → middleware → handlers (Env bindings,
 * D1 row shapes, JWT payloads).
 *
 * Env bindings used: declared here (DB, JWT_SECRET, POSTMARK_API_KEY,
 * FRONTEND_ORIGIN, FROM_EMAIL); other files import `Env` from this file.
 */

/**
 * Cloudflare Worker environment bindings.
 *
 * These values come from `wrangler.toml` (DB binding) and Wrangler secrets
 * (JWT_SECRET, POSTMARK_API_KEY, FROM_EMAIL set via `wrangler secret put`).
 * `FRONTEND_ORIGIN` is currently declared but not actively read — CORS uses a
 * hardcoded allowlist in `index.ts`. Keep declared so it remains type-safe if
 * we wire it back up.
 *
 * SECURITY: `JWT_SECRET` MUST be a Wrangler secret, never committed. Rotating
 * it invalidates every active session (all signed JWTs become unverifiable).
 */
export interface Env {
  /** D1 database binding. Schema: `users`, `password_reset_tokens`. */
  DB: D1Database;
  /** HMAC-SHA256 key for signing/verifying JWTs. Wrangler secret. */
  JWT_SECRET: string;
  /** Postmark Server API token (X-Postmark-Server-Token header). Wrangler secret. */
  POSTMARK_API_KEY: string;
  /** Allowed frontend origin — currently unused; see ALLOWED_ORIGINS in index.ts. */
  FRONTEND_ORIGIN: string;
  /** Verified Postmark sender address (e.g. help@meezer.com). Wrangler secret. */
  FROM_EMAIL: string;
}

/**
 * Row shape from the D1 `users` table.
 *
 * Column semantics (non-obvious):
 * - `password`: NOT a plaintext password — it's the base64 of PBKDF2-HMAC-SHA256
 *   derived bits (256 bits). See crypto.ts `hashPassword`. Column name is legacy.
 * - `salt`: base64-encoded 16 random bytes generated at registration / password change.
 *   Rotated on every password update so old hash + new salt cannot be reused.
 * - `data`: JSON-serialized blob of the user's tracker state (pulls + moduleProgress).
 *   Validated and replaced wholesale by PUT /data — see sync-data.ts.
 * - `updated_at`: bumped by D1's `datetime('now')` on every state-changing UPDATE.
 *   Returned to the client so it can detect stale local copies.
 *
 * Note: not every query selects every column — partial rows cast to UserRow are
 * common (e.g. login only selects id/email/password/salt). Treat unselected
 * fields as `undefined` at runtime.
 */
export interface UserRow {
  id: number;
  email: string;
  /** PBKDF2 derived hash, base64. NOT plaintext. See crypto.ts. */
  password: string;
  /** Per-user random salt, base64. Rotated on every password change. */
  salt: string;
  /** JSON-serialized tracker state. See sync-data.ts for validation rules. */
  data: string;
  updated_at: string;
  created_at: string;
}

/**
 * JWT claims signed with HS256.
 *
 * INVARIANTS:
 * - `sub` is the D1 `users.id` (numeric primary key) — handlers use it as the
 *   trusted user identifier. Never trust `email` from the JWT for DB lookups
 *   when the lookup is security-sensitive — email may be stale (user changed
 *   email but is still using an old token until it expires).
 * - `iat` and `exp` are UNIX seconds (NOT milliseconds). `exp` is enforced in
 *   crypto.ts `verifyJWT`.
 * - Token TTL is 30 days — see `createJWTPayload` in crypto.ts.
 */
export interface JWTPayload {
  /** Subject = users.id. The trusted user identifier. */
  sub: number;
  /** User's email at the time of issuance — may be stale after email change. */
  email: string;
  /** Issued-at, UNIX seconds. */
  iat: number;
  /** Expiry, UNIX seconds. Enforced in verifyJWT. */
  exp: number;
}
