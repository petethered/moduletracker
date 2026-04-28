/**
 * Cryptographic primitives for the ModuleTracker Worker.
 *
 * Role in the Worker: SECURITY-CRITICAL. Provides password hashing/verification,
 * JWT signing/verification, and reset-token generation. Every other file that
 * touches credentials goes through here.
 *
 * Request flow position: leaf module — used by auth.ts, account.ts,
 * middleware.ts. Not directly in the router.
 *
 * Env bindings used: indirectly — callers pass `env.JWT_SECRET` into
 * `signJWT` / `verifyJWT`. This file does not read env directly.
 *
 * ============================================================================
 * SECURITY INVARIANTS (do NOT change without a security review)
 * ============================================================================
 *
 * PASSWORD HASHING (key derivation):
 * - Algorithm: PBKDF2-HMAC-SHA256
 * - Iterations: 100,000 (OWASP minimum at time of writing for PBKDF2-SHA256
 *   was 600k; we picked 100k as a Workers-CPU-time compromise — Workers have
 *   tight CPU limits and bcrypt/argon2 aren't natively available via WebCrypto).
 *   If we ever migrate off PBKDF2 (recommended: argon2 via WASM), we MUST
 *   version the stored hash so legacy rows can still verify and be re-hashed
 *   on next login.
 * - Salt: 16 random bytes per user, base64-encoded. Generated fresh on every
 *   registration AND every password change. Stored in `users.salt`. Never
 *   reused across users.
 * - Output: 256 derived bits, base64-encoded. Stored in `users.password`
 *   (legacy column name — it is a hash, not a password).
 *
 * PASSWORD VERIFY:
 * - `verifyPassword` is CONSTANT-TIME (XOR-accumulate then compare to 0).
 *   Do NOT replace with `===` — that would leak information via timing.
 * - Length check first is intentional: if lengths differ the hashes can't
 *   match anyway, and we'd skew timing if we tried to compare different-length
 *   strings.
 *
 * JWT (HS256):
 * - Algorithm: HMAC-SHA256, secret = env.JWT_SECRET.
 * - Header is HARDCODED `{"alg":"HS256","typ":"JWT"}`. We do NOT parse the
 *   incoming header's `alg` field — this prevents the classic "alg: none" and
 *   algorithm-confusion attacks. If you ever add multi-algorithm support, do
 *   it via a strict allowlist, never by trusting the header.
 * - Encoding: base64url (RFC 4648 §5) for header / body / signature segments.
 * - TTL: 30 days. Set in `createJWTPayload`. `verifyJWT` enforces `exp`.
 * - Claim shape: see JWTPayload in types.ts. `sub` = users.id (the trusted id).
 * - There is no token revocation list — rotating JWT_SECRET is the only way
 *   to invalidate all outstanding tokens (e.g. on a breach).
 *
 * RESET TOKENS:
 * - 32 random bytes (256 bits), hex-encoded → 64-char string. Sent to the user
 *   in plaintext in the email URL. Only the SHA-256 of the token is stored in
 *   D1 — so a DB leak does not reveal active reset tokens.
 * - Lookup: hash the incoming token, find the row, then check expiry+used.
 *
 * ============================================================================
 */

import type { JWTPayload } from "./types";

/** PBKDF2 iteration count. See SECURITY INVARIANTS. Bump cautiously — too high
 *  and we hit the Worker CPU limit on login. */
const PBKDF2_ITERATIONS = 100_000;
/** 16 random bytes = 128 bits of salt entropy. */
const SALT_BYTES = 16;
/** 256-bit derived key matches SHA-256 output. */
const KEY_BITS = 256;

/**
 * Generate a fresh per-user salt: 16 random bytes, base64-encoded.
 *
 * `crypto.getRandomValues` is the cryptographically-secure RNG. We base64
 * the bytes (not hex) for compactness in D1.
 */
export function generateSalt(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  // String.fromCharCode + btoa is the standard "bytes to base64" idiom in
  // Workers (Buffer is not available).
  return btoa(String.fromCharCode(...salt));
}

/**
 * Derive a password hash via PBKDF2-HMAC-SHA256.
 *
 * Used for both registration (with a fresh salt) and verification (with the
 * stored salt for that user).
 *
 * @param password Plaintext password. Length is validated by callers (8..128).
 * @param salt     Base64-encoded salt from `generateSalt`.
 * @returns Base64-encoded 32-byte derived hash.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  // Import the password bytes as PBKDF2 key material. Not extractable.
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // Reverse of generateSalt's base64 encoding.
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_BITS,
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/**
 * Constant-time password verification.
 *
 * Re-derives the hash from `password` + stored `salt`, then compares to the
 * stored `hash` byte-by-byte without short-circuiting. The XOR-OR accumulator
 * pattern prevents timing oracles.
 *
 * IMPORTANT: do NOT "optimize" this to `computed === hash`. That's a string
 * compare which short-circuits on first mismatch and leaks position info.
 */
export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  // Different lengths can't match. Cheap early-out, no timing leak — both
  // strings are derived from the same KDF output so legitimate hashes always
  // share the same length.
  if (computed.length !== hash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    // OR-accumulating XOR of every char-code pair: result is 0 iff all chars
    // matched. Constant-time regardless of where the first mismatch is.
    mismatch |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * base64url encode (RFC 4648 §5). JWT segments use this, NOT plain base64
 * — `+`, `/`, `=` are URL-unsafe.
 */
function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * base64url decode → byte string. Note: caller is responsible for converting
 * to Uint8Array if they need bytes (see verifyJWT for the pattern).
 */
function base64urlDecode(str: string): string {
  // Restore standard base64 alphabet. atob tolerates missing `=` padding in
  // modern runtimes (V8/Workers), so we don't re-pad.
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

/**
 * Sign a JWT with HS256.
 *
 * Output format: `<header>.<body>.<signature>` where each segment is base64url.
 * Header is HARDCODED — see SECURITY INVARIANTS.
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signature = base64url(String.fromCharCode(...new Uint8Array(sig)));

  return `${data}.${signature}`;
}

/**
 * Verify a JWT and return its payload.
 *
 * THROWS on any failure — middleware.ts catches and converts to AuthError.
 * Specific failure messages here are NEVER surfaced to the client (see
 * middleware.ts for why).
 *
 * INVARIANTS enforced:
 * 1. Token has exactly 3 dot-separated segments.
 * 2. HMAC-SHA256 signature over `header.body` matches with our secret.
 *    NB: we re-sign with our hardcoded alg, not whatever the header claims.
 *    `crypto.subtle.verify` is constant-time.
 * 3. `exp` claim, if present, is in the future.
 *
 * Things this does NOT enforce (deliberate, but worth knowing):
 * - `iat` / `nbf` are not checked.
 * - `iss` / `aud` are not used.
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [header, body, signature] = parts;
  // We sign over the raw `header.body` ASCII — DON'T rebuild from decoded JSON.
  // Re-encoding could differ (key order, whitespace) and break verification.
  const data = `${header}.${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = Uint8Array.from(base64urlDecode(signature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data));
  if (!valid) throw new Error("Invalid signature");

  const payload: JWTPayload = JSON.parse(base64urlDecode(body));
  // `exp` is UNIX SECONDS, not millis. Don't divide Date.now() differently here
  // and elsewhere — must match createJWTPayload.
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

/**
 * Build a JWT payload with iat=now, exp=now+30d.
 *
 * Centralizing this so the TTL lives in exactly one place. If you change the
 * TTL, also consider how it interacts with email-change (the new email gets a
 * fresh 30-day token issued — old tokens still work until expiry, which is
 * intentional graceful behavior).
 */
export function createJWTPayload(userId: number, email: string): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: userId,
    email,
    iat: now,
    exp: now + 30 * 24 * 60 * 60, // 30 days, in seconds
  };
}

/**
 * Generate a password-reset token: 32 random bytes, hex-encoded (64 chars).
 *
 * The PLAINTEXT token goes in the email URL. The DB stores only sha256(token)
 * — so reading the DB does not reveal active reset tokens. See
 * `handleResetRequest` / `handleResetConfirm` in auth.ts for the full flow.
 */
export function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 of a UTF-8 string, returned as lowercase hex (64 chars).
 *
 * Used to hash reset tokens before storing/looking-up in D1. NOT for password
 * hashing — passwords go through PBKDF2 (`hashPassword`).
 */
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
