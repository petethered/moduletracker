import type { Env } from "./types";

export async function sendPasswordResetEmail(
  env: Env,
  toEmail: string,
  resetToken: string,
): Promise<void> {
  const resetUrl = `https://moduletracker.com?reset=${resetToken}`;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": env.POSTMARK_API_KEY,
    },
    body: JSON.stringify({
      From: env.FROM_EMAIL,
      To: toEmail,
      Subject: "ModuleTracker - Password Reset",
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
    throw new Error(`Postmark API error: ${res.status}`);
  }
}
