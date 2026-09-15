/**
 * Provider-agnostic email service (FR-13.2).
 * 
 * Set EMAIL_PROVIDER env var to:
 *   'console'  — logs to stdout (default in dev, no API key needed)
 *   'resend'   — uses Resend API (set RESEND_API_KEY)
 *   'sendgrid' — uses SendGrid API (set SENDGRID_API_KEY)
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendViaResend(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "noreply@clashofcode.dev",
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

async function sendViaSendGrid(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY is not set");

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: process.env.EMAIL_FROM || "noreply@clashofcode.dev" },
      subject: payload.subject,
      content: [
        { type: "text/html", value: payload.html },
        ...(payload.text ? [{ type: "text/plain", value: payload.text }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${body}`);
  }
}

function sendViaConsole(payload: EmailPayload): void {
  console.log(`\n📧 [EMAIL — CONSOLE MODE]\n  To: ${payload.to}\n  Subject: ${payload.subject}\n---\n${payload.text || payload.html}\n---\n`);
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();

  switch (provider) {
    case "resend":
      return sendViaResend(payload);
    case "sendgrid":
      return sendViaSendGrid(payload);
    case "console":
    default:
      return sendViaConsole(payload);
  }
}

// ── Typed email helpers ─────────────────────────────────────────────────────

export function emailPasswordReset(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: "Reset your ClashOfCode password",
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}

export function emailWelcome(to: string, username: string) {
  return sendEmail({
    to,
    subject: "Welcome to ClashOfCode ⚔️",
    html: `<p>Welcome, <strong>${username}</strong>! Your arena awaits. Head to the dashboard to find your first battle.</p>`,
    text: `Welcome, ${username}! Head to the ClashOfCode dashboard to find your first battle.`,
  });
}

export function emailMatchResult(to: string, result: { outcome: string; ratingDelta: number; opponentName: string }) {
  const sign = result.ratingDelta >= 0 ? "+" : "";
  return sendEmail({
    to,
    subject: `Battle result: You ${result.outcome} — ${sign}${result.ratingDelta} rating`,
    html: `<p>Your battle against <strong>${result.opponentName}</strong> ended in a <strong>${result.outcome}</strong>. Rating change: <strong>${sign}${result.ratingDelta}</strong>.</p>`,
    text: `You ${result.outcome} against ${result.opponentName}. Rating: ${sign}${result.ratingDelta}`,
  });
}
