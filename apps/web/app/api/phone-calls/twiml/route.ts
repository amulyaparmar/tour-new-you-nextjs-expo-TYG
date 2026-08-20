import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { getTwilioVoiceCallerId, normalizePhoneE164, validateTwilioVoiceWebhook } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readPayload(request: NextRequest) {
  return request.formData().then(async (form) => {
    const payload: Record<string, string> = {};
    for (const [key, value] of form.entries()) payload[key] = String(value ?? "");
    return payload;
  });
}

export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  if (!validateTwilioVoiceWebhook(request, payload)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }

  const destination = normalizePhoneE164(payload.To || payload.to || "");
  const sessionId = payload.sessionId || payload.SessionId || "";
  if (!destination || !sessionId) {
    return NextResponse.json({ error: "Missing destination or sessionId." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const callback = new URL(`${origin}/api/phone-calls/recording`);
  callback.searchParams.set("sessionId", sessionId);
  const status = new URL(`${origin}/api/phone-calls/status`);
  status.searchParams.set("sessionId", sessionId);

  const voiceResponse = new twilio.twiml.VoiceResponse();
  const dial = voiceResponse.dial({
    callerId: getTwilioVoiceCallerId(),
    answerOnBridge: true,
    record: "record-from-answer",
    recordingStatusCallback: callback.toString(),
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"],
    statusCallback: status.toString(),
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  } as any);
  dial.number(destination);

  return new NextResponse(voiceResponse.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}
