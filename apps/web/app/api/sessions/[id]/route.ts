import { NextResponse } from "next/server";

import { normalizeSessionCustomerInterests, type SessionStatus } from "@tour/shared";
import { listComments } from "@/lib/comments";
import { getTranscriptForSession } from "@/lib/evidence";
import {
  deleteSession,
  getAnalysisBySessionId,
  getConversationPhases,
  getSessionById,
  listFollowUpActions,
  setSessionStatus,
  updateSession,
} from "@/lib/sessions";
import { getRecordingPlaybackPath, getRecordingUrl, isLegacyLocalUrl } from "@/lib/storage";
import { AdminAuthError } from "@/lib/admin-auth";
import { requireSessionReadAccess, requireSessionWriteAccess } from "@/lib/session-access";

const VALID_STATUSES: SessionStatus[] = [
  "scheduled", "in_progress", "uploaded", "transcribing", "segmenting",
  "analyzing", "analysis_ready", "reviewed", "failed",
];

type Context = {
  params: Promise<{
    id: string;
  }>;
};

async function attachPlaybackUrls(session: NonNullable<Awaited<ReturnType<typeof getSessionById>>>) {
  const playbackPath = await getRecordingUrl(session.id);
  if (!playbackPath) return session;

  const isVideo = Boolean(session.videoUrl && !session.audioUrl);
  const needsUpdate =
    isLegacyLocalUrl(session.audioUrl) ||
    isLegacyLocalUrl(session.videoUrl) ||
    !session.audioUrl && !session.videoUrl;

  if (needsUpdate || session.audioUrl?.includes("supabase") || session.videoUrl?.includes("supabase")) {
    const path = getRecordingPlaybackPath(session.id);
    if (isVideo) {
      session.videoUrl = path;
    } else {
      session.audioUrl = path;
    }
  }

  return session;
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;

  try {
    const { session } = await requireSessionReadAccess(request, id);
    const includeReview = new URL(request.url).searchParams.get("view") === "review";

    const [, analysis, phases, transcript, actions, comments] = await Promise.all([
      attachPlaybackUrls(session),
      getAnalysisBySessionId(id),
      getConversationPhases(id),
      includeReview ? getTranscriptForSession(id) : Promise.resolve(null),
      includeReview ? listFollowUpActions(id) : Promise.resolve(null),
      includeReview ? listComments(id) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      session,
      analysis,
      phases,
      ...(includeReview ? { transcript, actions, comments } : {}),
    });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch session." },
      { status }
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    await requireSessionWriteAccess(request, id);
    const body = await request.json() as Record<string, unknown>;

    if (typeof body.status === "string") {
      if (!VALID_STATUSES.includes(body.status as SessionStatus)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      await setSessionStatus(id, body.status as SessionStatus);
    }

    const fields = {
      title: typeof body.title === "string" ? body.title : undefined,
      scheduledAt: typeof body.scheduledAt === "string" ? body.scheduledAt : undefined,
      prospectName: typeof body.prospectName === "string" ? body.prospectName : undefined,
      agentName: typeof body.agentName === "string" ? body.agentName : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      customerInterests: Array.isArray(body.customerInterests)
        ? normalizeSessionCustomerInterests(body.customerInterests)
        : undefined,
      rubricId: body.rubricId === null || typeof body.rubricId === "string" ? body.rubricId as string | null : undefined,
      agentId: body.agentId === null || typeof body.agentId === "string" ? body.agentId as string | null : undefined,
      propertyId: body.propertyId === null || typeof body.propertyId === "string" ? body.propertyId as string | null : undefined,
      unitLabel: body.unitLabel === null || typeof body.unitLabel === "string" ? body.unitLabel as string | null : undefined,
    };
    if (Object.values(fields).some((value) => value !== undefined)) {
      await updateSession(id, fields);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status }
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    await requireSessionWriteAccess(request, id);
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed." },
      { status }
    );
  }
}
