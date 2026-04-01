import { handleRegister, handleLogin, handleResetRequest, handleResetConfirm } from "./auth";
import { handleGetSyncData, handlePutSyncData } from "./sync-data";
import { handleChangeEmail, handleChangePassword } from "./account";
import { requireAuth, AuthError } from "./middleware";
import { jsonResponse } from "./response";
import type { Env } from "./types";

const ALLOWED_ORIGINS = [
  "https://moduletracker.com",
  "https://www.moduletracker.com",
  "http://localhost:5200",
  "http://localhost:5173",
];

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

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      let response: Response;

      // Public auth endpoints
      if (method === "POST" && path === "/auth/register") {
        response = await handleRegister(request, env);
      } else if (method === "POST" && path === "/auth/login") {
        response = await handleLogin(request, env);
      } else if (method === "POST" && path === "/auth/reset-request") {
        response = await handleResetRequest(request, env);
      } else if (method === "POST" && path === "/auth/reset-confirm") {
        response = await handleResetConfirm(request, env);
      }

      // Protected endpoints
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

      // Not found
      else {
        response = jsonResponse({ error: "Not found" }, 404);
      }

      return withCors(response, request);
    } catch (err) {
      if (err instanceof AuthError) {
        return withCors(jsonResponse({ error: err.message }, 401), request);
      }
      console.error("Unhandled error:", err);
      return withCors(jsonResponse({ error: "Internal server error" }, 500), request);
    }
  },
} satisfies ExportedHandler<Env>;
