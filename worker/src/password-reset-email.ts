/**
 * Postmark integration: send the password-reset email.
 *
 * Role in the Worker: outbound HTTP to Postmark's transactional email API.
 *
 * Request flow position: leaf utility. Called only from
 * `auth.handleResetRequest` after a reset token row has been written to D1.
 *
 * Env bindings used:
 *   - POSTMARK_API_KEY  → sent as `X-Postmark-Server-Token` header.
 *   - FROM_EMAIL        → must be a Postmark-verified sender (we use
 *                          help@meezer.com per project conventions). If this
 *                          is not verified in Postmark, sends 422.
 *
 * ----------------------------------------------------------------------------
 * Email flow & token lifecycle (full picture — search future agents will need)
 * ----------------------------------------------------------------------------
 *
 *   1. User POSTs /auth/reset-request with their email.
 *   2. auth.ts generates a 32-byte random token (hex, 64 chars), stores
 *      sha256(token) in `password_reset_tokens` with `expires_at = now + 1h`.
 *   3. THIS function sends the plaintext token in a URL:
 *        https://moduletracker.com?reset=<token>
 *      The frontend reads the `?reset=` query param and POSTs it back to
 *      /auth/reset-confirm with the new password.
 *   4. auth.handleResetConfirm hashes the incoming token, finds the row,
 *      checks expiry+used, rotates the password, and marks ALL of the user's
 *      reset tokens used in a single batch.
 *
 * Token TTL: 1 HOUR. Set in auth.ts (`expiresAt`), echoed in the email body.
 * If you change one, change both.
 *
 * ----------------------------------------------------------------------------
 * Postmark template usage
 * ----------------------------------------------------------------------------
 *
 * We use the plain `/email` endpoint with inline TextBody + HtmlBody, NOT a
 * stored Postmark template (`/email/withTemplate`). Reason: only one template
 * exists for the project, and inline keeps deploys simple — no out-of-band
 * "save the template in the Postmark dashboard" step. If/when we add more
 * email types, migrate to templates and pass a TemplateId.
 *
 * The Subject line "ModuleTracker - Password Reset" is also used as a
 * spam-filter signal — keep it clear and consistent.
 */

import type { Env } from "./types";

/**
 * Send a password-reset email via Postmark.
 *
 * Throws on non-2xx Postmark responses — auth.ts catches and silently swallows
 * (we never reveal email-send failures to the client; see auth.ts SECURITY).
 *
 * @param env         Worker env — POSTMARK_API_KEY + FROM_EMAIL.
 * @param toEmail     Recipient. Already validated by the caller.
 * @param resetToken  PLAINTEXT token (the value the user must POST back).
 *                    The DB stores sha256(this) — never log this value.
 */
export async function sendPasswordResetEmail(
  env: Env,
  toEmail: string,
  resetToken: string,
): Promise<void> {
  // The frontend handles `?reset=` on the landing page and shows the new-password
  // form. Hardcoded production origin — we don't email links to localhost.
  const resetUrl = `https://moduletracker.com?reset=${resetToken}`;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      // Postmark's "Server API Token" — distinct from "Account API Token".
      // Stored as a Wrangler secret.
      "X-Postmark-Server-Token": env.POSTMARK_API_KEY,
    },
    body: JSON.stringify({
      // Must be a Postmark-verified sender or the API returns 422.
      From: env.FROM_EMAIL,
      To: toEmail,
      Subject: "ModuleTracker - Password Reset",
      // Both Text and HTML bodies — Postmark requires at least one; sending
      // both improves deliverability and serves text-only mail clients.
      // The "1 hour" line below MUST match the TTL in auth.handleResetRequest.
      TextBody: [
        "You requested a password reset for your ModuleTracker account.",
        "",
        `Click here to reset your password: ${resetUrl}`,
        "",
        "This link expires in 1 hour.",
        "",
        "If you didn't request this, you can ignore this email.",
      ].join("\n"),
      HtmlBody: [
        "<h2>Password Reset</h2>",
        "<p>You requested a password reset for your ModuleTracker account.</p>",
        `<p><a href="${resetUrl}">Click here to reset your password</a></p>`,
        "<p>This link expires in 1 hour.</p>",
        "<p>If you didn't request this, you can ignore this email.</p>",
      ].join(""),
    }),
  });

  if (!res.ok) {
    // Surface ONLY the status — the body could contain the recipient address,
    // and auth.ts logs/swallows whatever we throw. Caller swallows, so this
    // mainly aids local debugging via `wrangler tail`.
    throw new Error(`Postmark API error: ${res.status}`);
  }
}
