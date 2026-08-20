import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { prepareAudioInsightsProcessing } from "@/lib/start-audio-insights-workflow";
import { getSessionById, recordSessionWorkflowStarted, setSessionStatus, updateSession } from "@/lib/sessions";
import { storeRecording } from "@/lib/storage";
import { processSessionWorkflow } from "@/workflows/process-session";
import { validateTwilioVoiceWebhook } from "@/lib/twilio";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const form = await request.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) payload[key] = String(value ?? "");
  if (!validateTwilioVoiceWebhook(request, payload)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }
  const recordingUrl = String(form.get("RecordingUrl") ?? "").trim();
  const recordingStatus = String(form.get("RecordingStatus") ?? "completed").trim();
  if (recordingStatus !== "completed" || !recordingUrl) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const session = await getSessionById(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (["transcribing", "segmenting", "analyzing", "analysis_ready", "reviewed"].includes(session.status)) {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const recordingResponse = await fetch(`${recordingUrl}.mp3`, {
      headers: accountSid && authToken
        ? { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` }
        : undefined,
      cache: "no-store",
    });
    if (!recordingResponse.ok) {
      throw new Error(`Twilio recording download failed (${recordingResponse.status}).`);
    }

    const blob = await recordingResponse.blob();
    await storeRecording(sessionId, blob);
    await updateSession(sessionId, {
      audioUrl: `/api/sessions/${sessionId}/recording`,
      duration: Number(form.get("RecordingDuration") ?? 0) || null,
    });
    await setSessionStatus(sessionId, "transcribing");
    await prepareAudioInsightsProcessing(sessionId);
    const run = await start(processSessionWorkflow, [sessionId]);
    await recordSessionWorkflowStarted(sessionId, "analysis", run.runId);

    return NextResponse.json({ ok: true, sessionId, runId: run.runId });
  } catch (error) {
    await setSessionStatus(sessionId, "failed").catch(() => {});
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the phone recording." },
      { status: 500 },
    );
  }
}
