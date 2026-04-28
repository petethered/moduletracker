/**
 * ModuleTracker Cloudflare Worker — entry point and router.
 *
 * Role in the Worker: top-level fetch handler. All requests land here.
 *
 * Request flow position: THIS FILE → middleware (requireAuth) → handler.
 *   1. CORS preflight (OPTIONS) is short-circuited with a 204 + CORS headers.
 *   2. Method+path is matched against the static route table below.
 *   3. Public routes (/auth/register, /auth/login, /auth/reset-*) are called
 *      directly.
 *   4. Protected routes call `requireAuth` first; on failure that throws
 *      AuthError, caught at the bottom and returned as 401.
 *   5. Every response — success or error — is wrapped via `withCors` so it
 *      ALWAYS carries CORS + security headers. Do not bypass this.
 *
 * Env bindings used: forwarded as `env` to handlers. Specifically:
 *   - DB              (auth, account, sync-data handlers)
 *   - JWT_SECRET      (auth, account, middleware)
 *   - POSTMARK_API_KEY (password reset email)
 *   - FROM_EMAIL      (password reset email)
 *   - FRONTEND_ORIGIN (declared, currently unused — CORS uses ALLOWED_ORIGINS).
 *
 * ----------------------------------------------------------------------------
 * Route table (full HTTP contracts):
 * ----------------------------------------------------------------------------
 *
 * POST /auth/register          [public]
 *   Body:    { email: string, password: string }
 *   Resp:    { token: string }                   on 201
 *            { error: string }                    on 400 (validation),
 *                                                    409 (duplicate email)
 *
 * POST /auth/login             [public]
 *   Body:    { email: string, password: string }
 *   Resp:    { token: string }                    on 200
 *            { error: string }                    on 400, 401
 *
 * POST /auth/reset-request     [public]
 *   Body:    { email: string }
 *   Resp:    { ok: true }                         on 200 (ALWAYS, even if the
 *                                                     email doesn't exist —
 *                                                     prevents enumeration).
 *
 * POST /auth/reset-confirm     [public]
 *   Body:    { token: string, newPassword: string }
 *   Resp:    { token: string }                    on 200 (auto-login JWT)
 *            { error: string }                    on 400 (invalid/expired)
 *
 * GET  /data                   [auth required: Bearer JWT]
 *   Resp:    { data: object, updatedAt: string }  on 200
 *            { error: string }                    on 401, 404
 *
 * PUT  /data                   [auth required: Bearer JWT]
 *   Body:    { data: { pulls: [...], moduleProgress: {...} } }
 *   Resp:    { ok: true, updatedAt: string }      on 200
 *            { error: string }                    on 400, 401, 413
 *
 * PUT  /auth/email             [auth required: Bearer JWT]
 *   Body:    { newEmail: string, password: string }
 *   Resp:    { ok: true, token: string }          on 200 (new JWT with new email)
 *            { error: string }                    on 400, 401, 404, 409
 *
 * PUT  /auth/password          [auth required: Bearer JWT]
 *   Body:    { currentPassword: string, newPassword: string }
 *   Resp:    { ok: true, token: string }          on 200 (refreshed JWT)
 *            { error: string }                    on 400, 401, 404
 *
 * Anything else → 404 { error: "Not found" }.
 * Any unhandled exception → 500 { error: "Internal server error" } + console.error.
 * ----------------------------------------------------------------------------
 */

import { handleRegister, handleLogin, handleResetRequest, handleResetConfirm } from "./auth";
import { handleGetSyncData, handlePutSyncData } from "./sync-data";
import { handleChangeEmail, handleChangePassword } from "./account";
import { requireAuth, AuthError } from "./middleware";
import { jsonResponse } from "./response";
import type { Env } from "./types";

/**
 * Hardcoded CORS allowlist. Update here when adding a new frontend origin.
 *
 * Why hardcoded vs env-driven: list rarely changes, and a misconfigured env
 * var would silently break the frontend. The localhost entries support the
 * Vite dev server (5173) and our preview port (5200).
 */
const ALLOWED_ORIGINS = [
  "https://moduletracker.com",
  "https://www.moduletracker.com",
  "http://localhost:5200",
  "http://localhost:5173",
];

/**
 * Build the CORS response headers for a given request.
 *
 * If the Origin is in the allowlist we echo it back (so credentials would work
 * if we ever enabled them). Otherwise we fall back to the canonical production
 * origin — this means a stray request from a non-allowed origin gets headers
 * that don't authorize *it*, which is the safe default.
 */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Security headers applied to every response (success or error).
 *
 * - HSTS: 1 year, includeSubDomains. Only meaningful over HTTPS (which is
 *   always the case on workers.dev / custom domains via Cloudflare).
 * - nosniff: block content-type sniffing.
 * - DENY: this API is never embedded in a frame.
 * - no-store: API responses are user-specific and tokenized; never cache.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

/**
 * Wrap a handler's Response with CORS + security headers.
 *
 * We rebuild the Response to ensure headers stick (Response.headers is a
 * read-only view in some runtimes if the Response was constructed elsewhere).
 * Body, status, and existing headers are preserved.
 */
function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export default {
  /**
   * Worker fetch entry point. Wrangler routes every request here.
   *
   * The single try/catch is deliberate: AuthError → 401, anything else → 500.
   * Handlers are expected to return a Response for their own validation
   * errors; only programming bugs / DB failures should land in the 500 path.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight — must NOT include the security headers (browsers expect
    // a minimal preflight). Allow methods/headers come from corsHeaders().
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      let response: Response;

      // ----- Public auth endpoints (no JWT required) -----
      if (method === "POST" && path === "/auth/register") {
        response = await handleRegister(request, env);
      } else if (method === "POST" && path === "/auth/login") {
        response = await handleLogin(request, env);
      } else if (method === "POST" && path === "/auth/reset-request") {
        response = await handleResetRequest(request, env);
      } else if (method === "POST" && path === "/auth/reset-confirm") {
        response = await handleResetConfirm(request, env);
      }

      // ----- Protected endpoints (JWT required via requireAuth) -----
      // requireAuth throws AuthError on failure → caught below → 401.
      // The verified JWTPayload is passed to the handler as the trusted
      // identity; handlers must use `user.sub` (NOT request body) for
      // user-id lookups.
      else if (method === "GET" && path === "/data") {
        const user = await requireAuth(request, env);
        response = await handleGetSyncData(user, env);
      } else if (method === "PUT" && path === "/data") {
        const user = await requireAuth(request, env);
        response = await handlePutSyncData(request, user, env);
      } else if (method === "PUT" && path === "/auth/email") {
        const user = await requireAuth(request, env);
        response = await handleChangeEmail(request, user, env);
      } else if (method === "PUT" && path === "/auth/password") {
        const user = await requireAuth(request, env);
        response = await handleChangePassword(request, user, env);
      }

      // ----- Fallback: route not matched -----
      else {
        response = jsonResponse({ error: "Not found" }, 404);
      }

      return withCors(response, request);
    } catch (err) {
      // AuthError is the canonical "you are not authenticated" signal from
      // requireAuth. Everything else is treated as an unexpected failure.
      if (err instanceof AuthError) {
        return withCors(jsonResponse({ error: err.message }, 401), request);
      }
      // Log the full error server-side (visible in `wrangler tail`) but
      // never leak details to the client — only a generic 500.
      console.error("Unhandled error:", err);
      return withCors(jsonResponse({ error: "Internal server error" }, 500), request);
    }
  },
} satisfies ExportedHandler<Env>;
