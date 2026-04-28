/**
 * Auth flows for the Module Tracker Cloudflare Worker backend.
 *
 * Role in the auth/sync stack:
 * - Thin wrappers around the Worker's `/auth/*` endpoints. Each function
 *   maps 1:1 to a Worker route and is responsible for storing the resulting
 *   JWT (when the Worker returns one).
 * - All HTTP work is delegated to api.ts — this file is intentionally trivial
 *   so that the auth contract with the Worker is easy to audit at a glance.
 *
 * JWT lifecycle handled here:
 * - register / login: Worker creates session, returns JWT, we persist it.
 * - reset confirm: Worker validates the email-link token, returns a fresh
 *   JWT (auto-login after reset).
 * - changeEmail / changePassword: Worker re-issues a JWT with updated
 *   claims (email) or rotated context, we replace the stored token so
 *   `getEmailFromToken()` stays accurate and the next request authenticates.
 * - logout: Pure local clear — there is no server-side revocation. The JWT
 *   would still validate at the Worker until it expires, but with no token
 *   stored locally we can't send it.
 * - requestPasswordReset: No JWT involved; Worker emails a reset link via
 *   Postmark (from help@meezer.com per project conventions).
 *
 * Worker / Postmark flow for password reset:
 * 1. User submits email -> requestPasswordReset() -> POST /auth/reset-request.
 * 2. Worker generates a single-use reset token, emails a link via Postmark.
 * 3. User clicks link, lands on a reset page with token in URL.
 * 4. UI calls confirmPasswordReset(token, newPassword) -> POST /auth/reset-confirm.
 * 5. Worker validates token, updates password hash, returns a fresh JWT.
 *
 * Non-obvious gotchas:
 * - All endpoints throw ApiError on non-2xx. UI must catch and display.
 *   The ApiError `code` field carries machine-readable reasons
 *   (e.g. EMAIL_TAKEN, WRONG_PASSWORD) — prefer that over message parsing.
 * - changeEmail returns a token shaped `{ ok, token }` because the Worker
 *   echoes a success flag for symmetry with other PUT endpoints; we only
 *   care about the token. Same for changePassword.
 * - These functions do NOT trigger a sync. After login, the caller is
 *   responsible for invoking the sync layer to pull cloud data and merge.
 * - There is no "current user" state here — auth.ts is stateless. Read
 *   `isAuthenticated()` / `getEmailFromToken()` from api.ts for current state.
 */

import { apiFetch, setToken, clearToken } from "./api";

// Standard shape returned by every auth endpoint that establishes a session.
// Kept private — callers don't need to see it; they get back void.
interface AuthResponse {
  token: string;
}

/**
 * Create a new account on the Worker and sign in.
 *
 * @param email - User's email. Worker validates format and uniqueness.
 * @param password - Plaintext password. Worker hashes (argon2/bcrypt).
 * @returns Resolves once the JWT is persisted; user is now signed in.
 *
 * @throws {ApiError} 409 EMAIL_TAKEN if email already registered;
 *   400 for validation failures (weak password, malformed email).
 *
 * @remarks
 * Side effect: calls `setToken` on success, replacing any existing token.
 * Caller should follow up with a sync pull to load any cloud data tied to
 * the email (rare for fresh registers, but defensive).
 */
export async function register(email: string, password: string): Promise<void> {
  const { token } = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
}

/**
 * Authenticate an existing account and store the resulting JWT.
 *
 * @param email - User's registered email.
 * @param password - Plaintext password; Worker compares against hash.
 * @returns Resolves once the JWT is persisted.
 *
 * @throws {ApiError} 401 INVALID_CREDENTIALS for wrong email/password;
 *   400 for malformed input.
 *
 * @remarks
 * Side effect: calls `setToken` on success. After this, the caller should
 * trigger sync.pullFromCloud() and merge with local state — login is the
 * primary entry point for cloud data hydration.
 */
export async function login(email: string, password: string): Promise<void> {
  const { token } = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
}

/**
 * Sign the user out locally.
 *
 * @remarks
 * - Synchronous, no network call. The JWT remains valid on the Worker until
 *   its `exp` claim — there is intentionally no server-side revocation
 *   endpoint (low-stakes app, JWTs are short-ish lived).
 * - Caller should also clear in-memory user state and decide what happens
 *   to the Zustand store (storageChoice="local" keeps data; switching back
 *   to cloud-only would clear data — handled by the UI, not here).
 */
export function logout() {
  clearToken();
}

/**
 * Kick off the email-based password reset flow.
 *
 * @param email - Email to send the reset link to. Worker uses Postmark
 *   (from help@meezer.com) to deliver the link.
 * @returns Resolves once the Worker accepts the request. NOTE: success
 *   does NOT mean the email exists — Worker intentionally responds 200
 *   regardless to avoid email enumeration attacks. UI should always show
 *   "if that email exists, you'll get a link" rather than confirming.
 *
 * @throws {ApiError} 429 if rate-limited (Worker throttles per-email and
 *   per-IP); 400 for malformed email.
 *
 * @remarks
 * No JWT side effect. Does not require an existing session. Pairs with
 * `confirmPasswordReset` once the user clicks the email link.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch("/auth/reset-request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Complete a password reset using the single-use token from the email link.
 *
 * @param token - The reset token extracted from the email link URL. This
 *   is NOT a JWT — it's a short-lived, single-use token signed by the
 *   Worker for password resets only.
 * @param newPassword - The user's chosen new password.
 * @returns Resolves once the password is updated AND the new JWT is stored
 *   (auto-login). User is signed in after this resolves.
 *
 * @throws {ApiError} 400 INVALID_TOKEN for expired / already-used / forged
 *   tokens; 400 for weak passwords.
 *
 * @remarks
 * Side effect: stores a fresh JWT — any previously-stored JWT is replaced.
 * The local `token` parameter is renamed to `jwt` in destructuring purely
 * to avoid shadowing the function parameter; both names refer to different
 * tokens (reset token in vs JWT out).
 */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const { token: jwt } = await apiFetch<AuthResponse>("/auth/reset-confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
  // Rename to `jwt` in destructuring above to avoid shadowing the reset
  // `token` parameter. We persist the JWT, NOT the reset token.
  setToken(jwt);
}

/**
 * Change the signed-in user's email address.
 *
 * @param newEmail - New email to associate with the account.
 * @param password - Current password, required as a re-auth check before
 *   the Worker mutates the account.
 * @returns Resolves once the email change succeeds and the new JWT (with
 *   updated `email` claim) is persisted.
 *
 * @throws {ApiError} 401 WRONG_PASSWORD if password check fails;
 *   409 EMAIL_TAKEN if newEmail is already used by another account;
 *   400 for malformed email.
 *
 * @remarks
 * - Worker re-issues the JWT so that getEmailFromToken() reflects the new
 *   email immediately, without forcing a re-login.
 * - Response shape is `{ ok, token }` (the `ok` flag is ignored here — the
 *   absence of a thrown ApiError is success enough).
 * - Does NOT trigger a sync — user data is keyed by user id on the Worker,
 *   not email, so cloud data is unaffected.
 */
export async function changeEmail(newEmail: string, password: string): Promise<void> {
  const { token } = await apiFetch<{ ok: boolean; token: string }>("/auth/email", {
    method: "PUT",
    body: JSON.stringify({ newEmail, password }),
  });
  setToken(token);
}

/**
 * Change the signed-in user's password.
 *
 * @param currentPassword - User's existing password (required re-auth).
 * @param newPassword - User's chosen new password.
 * @returns Resolves once the password is updated and the new JWT is stored.
 *
 * @throws {ApiError} 401 WRONG_PASSWORD if currentPassword check fails;
 *   400 for weak newPassword.
 *
 * @remarks
 * Worker re-issues a JWT after a password change. Strictly the old token
 * would still verify (we don't change the signing key), but re-issuing
 * resets the `iat` claim and any per-session context the Worker tracks.
 * Other devices logged in with the old token continue to work until their
 * tokens expire — there is no fan-out invalidation.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { token } = await apiFetch<{ ok: boolean; token: string }>("/auth/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  setToken(token);
}
