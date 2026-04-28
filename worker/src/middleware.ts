/**
 * Auth middleware for the ModuleTracker Worker.
 *
 * Role in the Worker: gatekeeper for protected routes. Extracts and verifies
 * the JWT from the `Authorization` header.
 *
 * Request flow position: router (index.ts) → THIS middleware → handler.
 * Called by `index.ts` immediately before invoking any protected handler
 * (GET /data, PUT /data, PUT /auth/email, PUT /auth/password).
 *
 * Env bindings used: `JWT_SECRET` (passed through to crypto.verifyJWT).
 *
 * CONTRACT:
 * - INPUT: a `Request` with `Authorization: Bearer <jwt>` header.
 * - SUCCESS: returns the verified `JWTPayload`. The handler then uses
 *   `payload.sub` as the trusted user id (never trust the body for identity).
 * - FAILURE: THROWS `AuthError` (NOT a Response). The catch block in
 *   `index.ts` converts AuthError → 401 JSON response. This means handlers
 *   never see a missing/invalid token — they can assume `user` is valid.
 *
 * SHORT-CIRCUIT BEHAVIOR: This is not a true Express-style "next" middleware.
 * It either returns the payload synchronously or throws — there is no `ctx`
 * object, the handler receives the payload as a parameter directly.
 *
 * SECURITY NOTES:
 * - We deliberately collapse "missing header", "wrong scheme", "malformed
 *   token", "bad signature", and "expired" into TWO messages to avoid leaking
 *   detail to attackers ("Missing authorization token" vs "Invalid or expired
 *   token"). Do not add finer-grained error messages here.
 * - The empty `catch {}` swallows the underlying crypto error. That's
 *   intentional — verifyJWT throws different strings for "Invalid token
 *   format" / "Invalid signature" / "Token expired" and we don't want any of
 *   them reaching the client.
 */

import { verifyJWT } from "./crypto";
import type { Env, JWTPayload } from "./types";

/**
 * Verify the request's bearer token and return the JWT payload.
 *
 * Throws `AuthError` on any failure (handled centrally in `index.ts`).
 *
 * @param request Incoming Worker Request.
 * @param env     Worker environment (used for JWT_SECRET).
 * @returns The verified JWT claims — `payload.sub` is the trusted user id.
 */
export async function requireAuth(request: Request, env: Env): Promise<JWTPayload> {
  // RFC 6750 bearer token format. Optional chaining handles a missing header.
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new AuthError("Missing authorization token");
  }
  // "Bearer ".length === 7
  const token = auth.slice(7);
  try {
    return await verifyJWT(token, env.JWT_SECRET);
  } catch {
    // Intentionally generic — see SECURITY NOTES in the file docblock.
    throw new AuthError("Invalid or expired token");
  }
}

/**
 * Sentinel error class so `index.ts` can distinguish auth failures (→ 401)
 * from generic exceptions (→ 500). Caught via `instanceof AuthError`.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
