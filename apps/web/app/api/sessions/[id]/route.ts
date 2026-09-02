import { NextResponse } from "next/server";

import { normalizeSessionCustomerInterests, type SessionStatus } from "@tour/shared";
import { deleteSession, getAnalysisBySessionId, getConversationPhases, setSessionStatus, updateSession } from "@/lib/sessions";
import { AdminAuthError } from "@/lib/admin-auth";
import { requireSessionReadAccess, requireSessionWriteAccess } from "@/lib/session-access";
import { attachSessionPlaybackUrls } from "@/lib/session-detail-response";

const VALID_STATUSES: SessionStatus[] = [
  "scheduled", "in_progress", "uploaded", "transcribing", "segmenting",
  "analyzing", "analysis_ready", "reviewed", "failed",
];

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;

  try {
    const { session } = await requireSessionReadAccess(request, id);

    const [sessionWithPlayback, analysis, phases] = await Promise.all([
      attachSessionPlaybackUrls(session),
      getAnalysisBySessionId(id),
      getConversationPhases(id),
    ]);

    return NextResponse.json({ session: sessionWithPlayback, analysis, phases });
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
