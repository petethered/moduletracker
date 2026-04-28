/**
 * JSON response helper.
 *
 * Role in the Worker: tiny utility used by every handler to build a Response.
 *
 * Request flow position: leaf utility — handlers call this to build their
 * Response, which `index.ts` then wraps with CORS + security headers via
 * `withCors` before returning to the client.
 *
 * Env bindings used: none.
 *
 * NOTE: Do NOT add CORS headers here. CORS is added centrally in `index.ts`
 * (`withCors`) so every code path — including error paths — gets consistent
 * headers. Adding them in two places risks divergence.
 */

/**
 * Build a JSON `Response` with the given body and status code.
 *
 * Sets `Content-Type: application/json`. The `index.ts` wrapper layers on
 * `Cache-Control: no-store`, HSTS, X-Frame-Options, etc. — so this function
 * intentionally does not duplicate those.
 *
 * @param data Anything `JSON.stringify`-able. Errors here will throw, which
 *             bubbles to `index.ts`'s catch block → 500.
 * @param status HTTP status code. Defaults to 200.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
