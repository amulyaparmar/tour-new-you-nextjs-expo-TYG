import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import type { SessionLead } from "@tour/shared";
import {
  formatRecordingUploadTitle,
  withRecordingParticipants,
} from "@tour/shared";
import { getRubricForSession } from "@/lib/rubrics";
import {
  addSessionLead,
  createSession,
  getSessionById,
  setSessionStatus,
  updateSession,
} from "@/lib/sessions";
import { getSupabaseServiceClient } from "@/lib/supabase";

type CheckInPropertyRow = {
  id: string;
  metadata: unknown;
};

const EXPLICIT_CHECK_IN_STATUSES = new Set(["scheduled", "in_progress"]);

class CheckInRequestError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      phone?: string | null;
      wantsSummary?: boolean;
      propertyName?: string | null;
      jobTitle?: string | null;
      reason?: string | null;
      questionAnswers?: Record<string, string>;
      repSlug?: string | null;
      repName?: string | null;
      propertyId?: string | null;
      sessionId?: string | null;
    };

    const firstName = body.firstName?.trim() || null;
    const lastName = body.lastName?.trim() || null;
    const name = body.name?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    const lead: SessionLead = {
      name,
      firstName,
      lastName,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      wantsSummary: body.wantsSummary ?? false,
      jobTitle: body.jobTitle?.trim() || null,
      reason: body.reason?.trim() || null,
      questionAnswers: body.questionAnswers && Object.keys(body.questionAnswers).length ? body.questionAnswers : undefined,
      repSlug: body.repSlug?.trim() || null,
      createdAt: new Date().toISOString()
    };

    const requestedSessionId = body.sessionId?.trim() || null;
    if (requestedSessionId && !isUuid(requestedSessionId)) {
      throw new CheckInRequestError("sessionId must be a UUID.", 400);
    }

    const propertyId = body.propertyId?.trim() || null;
    let agentId = body.repSlug?.trim() || null;
    let agentName = body.repName?.trim() || null;

    if (propertyId) {
      const { data, error } = await getSupabaseServiceClient()
        .from("propertiesTYG")
        .select("id,metadata")
        .eq("id", propertyId)
        .maybeSingle<CheckInPropertyRow>();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Property not found." }, { status: 404 });

      if (agentId) {
        const team = isRecord(data.metadata) && Array.isArray(data.metadata.property_team)
          ? data.metadata.property_team
          : [];
        const memberKey = agentId.toLowerCase().replace(/^@/, "");
        const member = team.find((candidate) => {
          if (!isRecord(candidate)) return false;
          const email = cleanString(candidate.email).toLowerCase();
          return [candidate.alias, candidate.id, candidate.user_id, candidate.userId, email.split("@")[0]]
            .map((value) => cleanString(value).toLowerCase().replace(/^@/, ""))
            .includes(memberKey);
        });
        if (isRecord(member)) {
          const alias = cleanString(member.alias);
          const authUserId = cleanString(member.user_id ?? member.userId);
          const memberId = cleanString(member.id);
          const emailLocal = cleanString(member.email).split("@")[0] ?? "";

          // Prefer auth id for ownership filters; alias is public URL key + fallback.
          agentId = authUserId
            ? `user:${authUserId}`
            : alias || memberId || emailLocal || agentId;
          agentName = cleanString(member.name) || agentName;
        } else {
          // A property-level check-in is valid even when the public link carries
          // a stale or missing team-member alias. Keep the property association
          // and create the lead without optional agent attribution.
          agentId = null;
          agentName = null;
          lead.repSlug = null;
        }
      }
    }

    if (requestedSessionId) {
      const existing = await getSessionById(requestedSessionId);
      if (existing) {
        validateExplicitSession(existing, propertyId);
        const replaceProspectName = isPlaceholderProspectName(existing.prospectName);
        const prospectName = replaceProspectName ? lead.name : existing.prospectName;
        const title = withRecordingParticipants(
          existing.title,
          existing.agentName,
          prospectName,
        );

        await addSessionLead(existing.id, lead);
        const updates: Parameters<typeof updateSession>[1] = {};
        if (replaceProspectName) {
          updates.prospectName = lead.name;
        }
        if (title !== existing.title) {
          updates.title = title;
        }
        if (Object.keys(updates).length) {
          await updateSession(existing.id, updates);
        }
        if (existing.status === "scheduled") {
          await setSessionStatus(existing.id, "in_progress");
        }
        notifySessionCheckIn(existing, lead.name);
        return NextResponse.json(
          {
            sessionId: existing.id,
            grouped: true,
            startRecording: true,
            binding: "explicit",
          },
          { status: 200 },
        );
      }
    }

    const property = body.propertyName?.trim() || "Property";
    const scheduledAt = new Date();
    const rubric = await getRubricForSession(null, propertyId);
    const session = await createSession({
      // A URL-provided UUID becomes the real row ID on first check-in. With no
      // UUID, this submission starts a fresh session—there is no time-window match.
      id: requestedSessionId ?? randomUUID(),
      title: withRecordingParticipants(
        formatRecordingUploadTitle(scheduledAt, rubric.sessionType),
        agentName,
        lead.name,
        rubric.sessionType,
      ),
      status: "in_progress",
      scheduledAt: scheduledAt.toISOString(),
      prospectName: lead.name,
      agentName,
      agentId,
      location: property,
      source: "qr",
      leads: [lead],
      rubricId: rubric.id,
      propertyId,
    });

    return NextResponse.json({ sessionId: session.id, grouped: false, startRecording: true }, { status: 201 });
  } catch (error) {
    const status =
      error instanceof CheckInRequestError
        ? error.status
        : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit lead." },
      { status }
    );
  }
}

function validateExplicitSession(
  session: NonNullable<Awaited<ReturnType<typeof getSessionById>>>,
  requestedPropertyId: string | null,
) {
  if (!EXPLICIT_CHECK_IN_STATUSES.has(session.status)) {
    throw new CheckInRequestError(
      "This session is no longer accepting check-ins.",
      409,
    );
  }
  if (!session.propertyId) {
    throw new CheckInRequestError(
      "This session is not assigned to a property.",
      409,
    );
  }
  if (requestedPropertyId && requestedPropertyId !== session.propertyId) {
    throw new CheckInRequestError(
      "This check-in link does not match the session property.",
      403,
    );
  }
}

function isPlaceholderProspectName(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return (
    !normalized
    || ["prospect", "guest", "visitor", "lead", "customer", "client", "unknown", "n/a"]
      .includes(normalized)
  );
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function notifySessionCheckIn(
  session: {
    id: string;
    propertyId?: string | null;
    agentId?: string | null;
  },
  leadName: string,
) {
  const propertyId = session.propertyId;
  if (!propertyId) return;
  void import("@/lib/push")
    .then(({ notifyNewSession }) =>
      notifyNewSession({
        propertyId,
        sessionId: session.id,
        title: leadName,
        agentId: session.agentId,
        source: "qr",
        autoStartRecording: true,
      }),
    )
    .catch(() => {});
}
