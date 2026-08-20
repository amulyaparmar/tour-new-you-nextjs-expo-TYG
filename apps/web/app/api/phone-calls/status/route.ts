import { NextResponse } from "next/server";

import { setSessionStatus } from "@/lib/sessions";
import { validateTwilioVoiceWebhook } from "@/lib/twilio";

export async function POST(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const form = await request.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) payload[key] = String(value ?? "");
  if (!validateTwilioVoiceWebhook(request, payload)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }
  const status = String(form.get("CallStatus") ?? "");
  if (["in-progress", "answered"].includes(status)) await setSessionStatus(sessionId, "in_progress");
  if (["busy", "failed", "no-answer", "canceled"].includes(status)) await setSessionStatus(sessionId, "failed");
  return NextResponse.json({ ok: true });
}
