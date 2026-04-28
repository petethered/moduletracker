/**
 * User-data sync endpoints: GET /data, PUT /data.
 *
 * Role in the Worker: persists / retrieves the user's tracker state (pulls +
 * moduleProgress) as a JSON blob in the `users.data` column.
 *
 * Request flow position: index.ts router → middleware.requireAuth → THIS file.
 * Both handlers receive a verified `JWTPayload` as `user`; `user.sub` is the
 * trusted users.id used for every DB lookup.
 *
 * Env bindings used: DB only.
 *
 * ----------------------------------------------------------------------------
 * D1 schema dependency
 * ----------------------------------------------------------------------------
 *
 * `users` table (referenced columns):
 *   id          INTEGER PRIMARY KEY
 *   data        TEXT          -- JSON-stringified blob of tracker state
 *   updated_at  TEXT          -- ISO-ish, set via D1's datetime('now') on each PUT
 *
 * The `data` column stores a single JSON document of shape:
 *   {
 *     "pulls":          [...],            -- array of pull entries
 *     "moduleProgress": { ...keyed map }, -- object mapping module id → progress
 *     ...other client-side state may be present and is preserved verbatim
 *   }
 *
 * The Worker validates ONLY the two structural invariants (pulls is array,
 * moduleProgress is non-array object). Anything else inside is opaque — we
 * round-trip it untouched. This keeps the server schema-light: the frontend
 * (src/store/) owns the shape; adding fields to localStorage doesn't require
 * a Worker deploy.
 *
 * ----------------------------------------------------------------------------
 * Merge / conflict strategy: LAST-WRITE-WINS (no merge)
 * ----------------------------------------------------------------------------
 *
 * PUT /data is a WHOLESALE REPLACE — the incoming `data` object completely
 * overwrites whatever was stored. There is NO union, NO field-level merge, NO
 * version vector / etag check.
 *
 * Implication: if the same user has the app open in two tabs/devices and they
 * each PUT, the second write silently clobbers the first. The client mitigates
 * this by GETing on app start and tracking `updatedAt`, but there is no
 * server-side conflict detection. If we ever need that, the path forward is:
 *   - Add an If-Match header carrying the client's `updatedAt`.
 *   - Reject PUTs whose If-Match doesn't equal the current row's updated_at.
 *
 * Returning `updatedAt` from PUT lets the client refresh its local watermark
 * so subsequent GETs can be skipped if the server hasn't moved.
 *
 * ----------------------------------------------------------------------------
 * Size limits
 * ----------------------------------------------------------------------------
 *
 * 1 MB cap, enforced TWICE:
 *   1. Content-Length (cheap pre-check; can be missing or lying).
 *   2. JSON.stringify(data).length AFTER parsing (authoritative).
 * Both return 413. The double-check matters because clients may omit
 * Content-Length, or send a chunked body that's larger than the header
 * suggests.
 */

import { jsonResponse } from "./response";
import type { Env, JWTPayload } from "./types";

/** 1 MB — generous for a JSON blob of pulls + module progress.
 *  Chosen to keep D1 row writes fast and discourage accidental megablobs. */
const MAX_PAYLOAD_BYTES = 1_048_576; // 1 MB

/**
 * GET /data — return the user's stored sync blob.
 *
 * Resp: 200 { data: object, updatedAt: string }
 *       404 if the user row is missing (shouldn't happen post-auth, but
 *           defensive — could occur if the account was deleted between JWT
 *           issuance and this request).
 *
 * `data` is JSON.parsed before return — the client gets a real object, not a
 * string. If the DB row contains malformed JSON, JSON.parse throws → bubbles
 * to index.ts catch → 500.  That row should not exist (we always JSON.stringify
 * on PUT), but worth knowing if you're debugging a 500 here.
 */
export async function handleGetSyncData(user: JWTPayload, env: Env): Promise<Response> {
  // Trusted user id from the JWT (`sub`).
  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM users WHERE id = ?",
  ).bind(user.sub).first<{ data: string; updated_at: string }>();

  if (!row) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  return jsonResponse({
    data: JSON.parse(row.data),
    updatedAt: row.updated_at,
  });
}

/**
 * PUT /data — wholesale-replace the user's sync blob.
 *
 * Body: { data: { pulls: [...], moduleProgress: {...}, ... } }
 * Resp: 200 { ok: true, updatedAt }     — new server timestamp
 *       400 invalid data shape
 *       413 payload too large (> 1 MB)
 *
 * Validation is intentionally minimal — see file docblock for the schema
 * philosophy. We check only:
 *   - body.data is a non-null object (not array)
 *   - data.pulls is an array
 *   - data.moduleProgress is a non-array object
 * Everything else inside is round-tripped unmodified.
 */
export async function handlePutSyncData(request: Request, user: JWTPayload, env: Env): Promise<Response> {
  // First-pass size check via Content-Length. May be missing (chunked) or
  // lying, hence the post-parse check below.
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "Payload too large (max 1 MB)" }, 413);
  }

  const body = await request.json<{ data: unknown }>();
  const { data } = body;

  // typeof null === "object" so we explicitly reject null. Arrays are also
  // typeof "object" — rejected because the top-level shape must be a plain
  // object containing `pulls` and `moduleProgress`.
  if (!data || typeof data !== "object") {
    return jsonResponse({ error: "Invalid data format" }, 400);
  }

  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.pulls)) {
    return jsonResponse({ error: "data.pulls must be an array" }, 400);
  }
  // moduleProgress: non-null, non-array, plain object. Same null/array
  // gotchas as the outer check.
  if (typeof d.moduleProgress !== "object" || d.moduleProgress === null || Array.isArray(d.moduleProgress)) {
    return jsonResponse({ error: "data.moduleProgress must be an object" }, 400);
  }

  // Authoritative size check on the canonicalized JSON. Note this uses
  // `.length` (UTF-16 code units), which is a slight over- or under-estimate
  // of byte length depending on content — fine for an upper-bound DoS guard.
  const jsonStr = JSON.stringify(data);
  if (jsonStr.length > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "Payload too large (max 1 MB)" }, 413);
  }

  // Wholesale replace. RETURNING updated_at avoids a follow-up SELECT.
  // No optimistic-concurrency check — see merge strategy notes in the file
  // docblock (last-write-wins by design).
  const result = await env.DB.prepare(
    "UPDATE users SET data = ?, updated_at = datetime('now') WHERE id = ? RETURNING updated_at",
  ).bind(jsonStr, user.sub).first<{ updated_at: string }>();

  return jsonResponse({ ok: true, updatedAt: result!.updated_at });
}
