/**
 * Low-level HTTP client for the Module Tracker Cloudflare Worker backend.
 *
 * Role in the auth/sync stack:
 * - This is the ONLY module that talks directly to `fetch`. Everything else
 *   (auth.ts, sync.ts, future feature services) goes through `apiFetch`.
 * - Owns the JWT token lifecycle in localStorage: read, write, clear, decode.
 * - Centralizes 401 handling so a single expired-token signal can bubble up
 *   to the UI (which clears the user, surfaces a re-login prompt, etc).
 *
 * Backend contract:
 * - Base URL is the Cloudflare Worker (D1-backed). Override locally with
 *   VITE_API_URL (e.g. `http://127.0.0.1:8787` for `wrangler dev`).
 * - Worker returns JSON. Errors come back as `{ error: string, code?: string }`
 *   with a non-2xx status. We normalize all of those to ApiError.
 *
 * JWT format gotcha:
 * - We `atob` the middle segment of the JWT to read claims (exp, email)
 *   client-side. This is decoding ONLY — it is not verification. The Worker
 *   signs and verifies; the client just peeks at expiry/email for UX.
 * - `atob` will throw on malformed base64 — every decode is wrapped in
 *   try/catch so a corrupt token never crashes the app, it just behaves as
 *   "not authenticated" and the next 401 will clear it.
 *
 * Non-obvious gotchas:
 * - We do NOT auto-refresh tokens. The Worker issues long-lived JWTs and we
 *   re-issue on auth-mutating endpoints (login, change email, change password,
 *   reset confirm). On 401 we clear the token and notify via onAuthExpired.
 * - localStorage is shared with the rest of the app under the `mt-*` prefix.
 *   Do not rename TOKEN_KEY without a migration — existing users will be
 *   silently logged out.
 * - There is no request retry / backoff here. Sync layer handles its own
 *   retry semantics (debounced push, manual pull).
 */

// Cloudflare Worker base URL. VITE_API_URL is read at build time by Vite's
// `define` plugin; falls back to the production Worker hostname.
const API_BASE = import.meta.env.VITE_API_URL || "https://api.moduletracker.com";

// localStorage key for the JWT. Keep in sync with any other code that
// inspects auth state directly (currently nothing else should).
const TOKEN_KEY = "mt-auth-token";

/**
 * Error thrown by `apiFetch` for any non-2xx response from the Worker.
 *
 * @remarks
 * - `status` is the HTTP status code from the Worker.
 * - `code` is an optional machine-readable error code from the Worker body
 *   (e.g. "EMAIL_TAKEN", "INVALID_PASSWORD"). UI uses this for i18n / specific
 *   error rendering rather than parsing message strings.
 * - Network failures (fetch rejecting) are NOT ApiError — they bubble as
 *   TypeError. Sync layer catches both via bare `catch {}`.
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// Single global callback fired when the Worker rejects our token (401).
// Set once at app boot by the auth-aware shell (e.g. to navigate to login
// and clear in-memory user state). Module-scoped singleton — there is only
// ever one listener, intentionally, to avoid fan-out surprises.
let onAuthExpired: (() => void) | null = null;

/**
 * Register the callback to invoke whenever the Worker returns 401.
 *
 * @param callback - Invoked AFTER the local token is cleared. Use it to
 *   reset Zustand auth state and route the user to the login screen.
 *
 * @remarks
 * Calling this more than once replaces the previous callback (intentional).
 * No-op cleanup is required because there is only one slot.
 */
export function setOnAuthExpired(callback: () => void) {
  onAuthExpired = callback;
}

/**
 * Read the raw JWT from localStorage.
 *
 * @returns The token string, or null if none is stored.
 *
 * @remarks
 * Does NOT validate expiry — use `isAuthenticated()` for that. This is the
 * raw read used by `apiFetch` to attach the Authorization header.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Persist a new JWT to localStorage.
 *
 * @param token - The signed JWT returned by the Worker (login/register/etc).
 *
 * @remarks
 * Side effect: overwrites any existing token. Callers in auth.ts call this
 * on every auth-mutating endpoint because the Worker re-issues a token after
 * email changes (claims now contain new email) and password changes (rotates
 * the signing context). Sync layer does NOT call this.
 */
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the JWT from localStorage.
 *
 * @remarks
 * Called on logout, on 401 (auto-clear), and after a destructive action that
 * should force re-auth. Does NOT trigger onAuthExpired — only the apiFetch
 * 401 path does that, because explicit clears already know what to do next.
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Cheap client-side check: do we have a non-expired JWT?
 *
 * @returns true iff a token exists AND its `exp` claim is in the future.
 *
 * @remarks
 * - This is a UX gate, not a security check. The Worker is the source of
 *   truth — a valid-looking token can still be rejected (revoked, signing
 *   key rotated, etc). Always treat 401 as the real signal.
 * - `exp` is in seconds (JWT spec); `Date.now()` is in ms — divide by 1000.
 * - Any decode failure (malformed token, missing payload) returns false
 *   rather than throwing, so this is safe to call eagerly on app boot.
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    // Decode the middle segment (payload) of the JWT. We are NOT verifying
    // the signature — that's the Worker's job. We only need the exp claim.
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp > Date.now() / 1000;
  } catch {
    // Corrupt token (bad base64, non-JSON payload). Treat as logged out;
    // the next API call will 401 and clear it cleanly.
    return false;
  }
}

/**
 * Extract the user's email from the current JWT's claims.
 *
 * @returns The email claim string, or null if no token / decode failed /
 *   the claim is missing.
 *
 * @remarks
 * Used by the UI to display the signed-in user without an extra round trip.
 * Same caveat as `isAuthenticated`: this is a UX read, not a verified
 * identity. The Worker baked this email into the JWT at issue time; if the
 * user changes email, auth.ts re-issues the token so this stays in sync.
 */
export function getEmailFromToken(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || null;
  } catch {
    // Same defensive posture as isAuthenticated — never throw from a getter.
    return null;
  }
}

/**
 * Generic typed fetch wrapper for the Cloudflare Worker.
 *
 * @typeParam T - The expected JSON response shape on success.
 * @param path - Path relative to API_BASE, must start with "/".
 * @param options - Standard `RequestInit`. `Content-Type: application/json`
 *   and the Bearer token are added automatically; do not override them
 *   unless you know what you're doing.
 * @returns The parsed JSON body typed as T.
 *
 * @throws {ApiError} For any non-2xx response. `status` is the HTTP code,
 *   `message`/`code` come from the Worker JSON body when available.
 * @throws {TypeError} For network failures (fetch rejects). Callers should
 *   handle both — sync.ts uses bare `catch {}` and inspects navigator.onLine.
 *
 * @remarks
 * Side effects on 401:
 * 1. Token is cleared from localStorage (so subsequent calls go unauthed).
 * 2. `onAuthExpired` callback fires (lets the UI react synchronously).
 * The error is still thrown after, so the caller's catch block also runs.
 *
 * No retry / backoff here by design — that would mask real auth failures.
 * Layers above (sync) decide their own retry policy.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  // Always send JSON; conditionally attach Bearer token. Spread order matters:
  // caller-provided headers in `options` would override these if we did it
  // the other way, but currently nothing in the codebase passes headers.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) {
      // Token is invalid/expired/revoked per the Worker. Clear it eagerly so
      // any concurrent calls don't pile up more 401s, then notify the app.
      // We still throw below so the caller sees the failure.
      clearToken();
      onAuthExpired?.();
    }
    // Best-effort body parse: the Worker should return JSON, but on infra
    // errors (502, etc) we may get HTML or empty. Fall back to statusText.
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText, body.code);
  }

  // All Worker endpoints return JSON; if a future endpoint returns 204 we'll
  // need to special-case it here (res.json() would throw on empty body).
  return res.json();
}
