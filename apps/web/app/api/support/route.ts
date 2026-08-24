import { NextResponse } from "next/server";

import { sendTransactionalEmail } from "@/lib/transactional-email";

const SUPPORT_RECIPIENT = "parmar.amulya@gmail.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = clean(body?.name);
  const email = clean(body?.email).toLowerCase();
  const category = clean(body?.category) || "General question";
  const message = clean(body?.message);
  const honeypot = clean(body?.website);

  // Quietly accept bot submissions without sending mail.
  if (honeypot) return NextResponse.json({ ok: true });
  if (!name || name.length > 120) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (message.length < 10 || message.length > 5000) return NextResponse.json({ error: "Please include a little more detail in your message." }, { status: 400 });

  const submittedAt = new Date().toISOString();
  const delivery = await sendTransactionalEmail({
    to: [SUPPORT_RECIPIENT],
    replyTo: email,
    subject: `[Tour Support] ${category} — ${name}`,
    text: [
      "New Tour support request",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${category}`,
      `Submitted: ${submittedAt}`,
      "",
      message,
    ].join("\n"),
    html: [
      "<h2>New Tour support request</h2>",
      `<p><strong>Name:</strong> ${escapeHtml(name)}<br><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Topic:</strong> ${escapeHtml(category)}<br><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>`,
      `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    ].join(""),
  });

  if (!delivery.configured || delivery.delivered < 1) {
    console.error("Support email delivery failed", { configured: delivery.configured, failed: delivery.failed });
    return NextResponse.json({ error: "Support is temporarily unavailable. Please email us directly." }, { status: 503 });
  }
  void import("@/lib/push").then(({ notifySupportRequest }) =>
    notifySupportRequest({ name, category, message }),
  ).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
