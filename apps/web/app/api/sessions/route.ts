import { NextRequest, NextResponse } from "next/server";

import { normalizeSessionCustomerInterests, type SessionKind, type SessionStatus } from "@tour/shared";
import {
  ADMIN_COMMUNITY_COOKIE,
  hasAdminSession,
  readAdminCookie,
  propertySessionKeys,
  requireAdminContext,
  resolveFallbackAdminContext,
} from "@/lib/admin-auth";
import { listTeamAgents } from "@/lib/agents";
import { createSession, listSessionsPaginated } from "@/lib/sessions";
import {
  buildSessionTourTitle,
  formatRecordingUploadTitle,
  isRecordingUploadTitle,
  withRecordingParticipants,
} from "@tour/shared";
import { getRubricForSession } from "@/lib/rubrics";

const VALID_STATUSES: SessionStatus[] = [
  "scheduled", "in_progress", "uploaded", "transcribing", "segmenting",
  "analyzing", "analysis_ready", "reviewed", "failed",
];
const COMPLETED_STATUSES: SessionStatus[] = ["analysis_ready", "reviewed"];

const VALID_SORTS = ["newest", "oldest", "score_desc", "score_asc", "scheduled_asc"] as const;
const VALID_SESSION_KINDS: SessionKind[] = ["tour", "call", "ai_call"];

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
    const search = sp.get("search")?.trim() || undefined;
    const upcoming = sp.get("upcoming") === "true";
    const statusParam = sp.get("status");
    const status = statusParam && VALID_STATUSES.includes(statusParam as SessionStatus)
      ? statusParam as SessionStatus
      : undefined;
    const statuses = statusParam === "completed" ? COMPLETED_STATUSES : undefined;
    const sortParam = sp.get("sort") as (typeof VALID_SORTS)[number] | null;
    const sort = sortParam && (VALID_SORTS as readonly string[]).includes(sortParam)
      ? sortParam as (typeof VALID_SORTS)[number]
      : undefined;
    const sessionKindParam = sp.get("type") ?? sp.get("sessionKind");
    const sessionKind = sessionKindParam && VALID_SESSION_KINDS.includes(sessionKindParam as SessionKind)
      ? sessionKindParam as SessionKind
      : undefined;

    const workspace = hasAdminSession(request)
      ? await requireAdminContext(request)
      : await resolveFallbackAdminContext(readAdminCookie(request, ADMIN_COMMUNITY_COOKIE));

    const propertyParam = sp.get("propertyId");
    const accessibleProperties = workspace?.communities ?? [];
    const accessiblePropertyIds = accessibleProperties.map((community) => community.propertyTygId);
    let propertyId: string | undefined;
    let propertyIds: string[] | undefined;

    if (propertyParam === "all") {
      propertyIds = accessibleProperties.flatMap(propertySessionKeys);
    } else if (propertyParam) {
      const requestedProperty = accessibleProperties.find(
        (community) => community.propertyTygId === propertyParam
      );
      if (!requestedProperty) {
        return NextResponse.json(
          { error: "That property is not available to this team member." },
          { status: 403 }
        );
      }
      propertyIds = propertySessionKeys(requestedProperty);
    } else if (workspace?.community) {
      propertyIds = propertySessionKeys(workspace.community);
    }

    const agentParam = sp.get("agentId")?.trim();
    let agentIds: string[] | undefined;
    if (agentParam && workspace) {
      const teamAgents = await listTeamAgents(workspace.communities);
      const selectedAgent = teamAgents.find((agent) =>
        agent.id === agentParam ||
        (agent.authUserId ? `user:${agent.authUserId}` === agentParam : false)
      );
      if (selectedAgent) {
        agentIds = [...new Set([
          selectedAgent.id,
          selectedAgent.authUserId ?? "",
          selectedAgent.authUserId ? `user:${selectedAgent.authUserId}` : "",
        ].filter(Boolean))];
      }
    }

    const result = await listSessionsPaginated({
      page,
      limit,
      search,
      status,
      statuses,
      sort,
      propertyId,
      propertyIds,
      agentIds,
      sessionKind,
      excludeScheduled: !upcoming,
      upcomingFrom: upcoming ? new Date().toISOString() : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch sessions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const workspace = hasAdminSession(request)
      ? await requireAdminContext(request)
      : await resolveFallbackAdminContext(readAdminCookie(request, ADMIN_COMMUNITY_COOKIE));
    const body = (await request.json()) as {
      title?: string;
      sourceFileName?: string | null;
      titleIsAuto?: boolean;
      scheduledAt?: string | null;
      location?: string | null;
      prospectName?: string | null;
      agentName?: string | null;
      uploaderIsAgent?: boolean;
      notes?: string | null;
      customerInterests?: unknown;
      rubricId?: string | null;
      agentId?: string | null;
      propertyId?: string | null;
      unitLabel?: string | null;
      source?: "manual" | "qr";
      status?: SessionStatus;
      sessionKind?: SessionKind;
    };

    if (!body.title?.trim() && !body.sourceFileName?.trim() && !body.prospectName?.trim() && !body.agentName?.trim() && !body.uploaderIsAgent) {
      return NextResponse.json({ error: "title, sourceFileName, prospectName, or agentName is required." }, { status: 400 });
    }

    const requestedPropertyId = body.propertyId?.trim() || workspace.community.propertyTygId;
    if (!workspace.communities.some((community) => community.propertyTygId === requestedPropertyId)) {
      return NextResponse.json({ error: "That property is not available to this team member." }, { status: 403 });
    }

    const agentName = body.agentName ?? (body.uploaderIsAgent ? workspace.user.fullName : null);
    const agentId = body.agentId !== undefined
      ? body.agentId?.trim() || null
      : body.uploaderIsAgent
        ? `user:${workspace.user.id}`
        : null;
    const prospectName = body.prospectName ?? null;
    const scheduledAt = body.scheduledAt ?? null;
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const rubric = await getRubricForSession(body.rubricId, requestedPropertyId);
    const automaticTitle = body.title?.trim()
      || formatRecordingUploadTitle(
        Number.isNaN(scheduledDate.getTime()) ? new Date() : scheduledDate,
        rubric.sessionType,
      );
    const source = body.source === "qr" ? "qr" : "manual";
    const status = source === "qr" && body.status === "in_progress"
      ? "in_progress"
      : undefined;
    const titleIsAuto =
      !body.title?.trim()
      || body.titleIsAuto === true
      || isRecordingUploadTitle(body.title);
    const session = await createSession({
      title: titleIsAuto
        ? withRecordingParticipants(
            automaticTitle,
            agentName,
            prospectName,
            rubric.sessionType,
          )
        : buildSessionTourTitle({
            title: body.title,
            agentName,
            prospectName,
          }),
      sourceFileName: body.sourceFileName ?? null,
      status,
      scheduledAt,
      location: body.location ?? null,
      prospectName,
      agentName,
      notes: body.notes ?? null,
      customerInterests: normalizeSessionCustomerInterests(body.customerInterests),
      source,
      sessionKind: body.sessionKind,
      rubricId: rubric.id,
      agentId,
      propertyId: requestedPropertyId,
      unitLabel: body.unitLabel ?? null
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session." },
      { status: 500 }
    );
  }
}
