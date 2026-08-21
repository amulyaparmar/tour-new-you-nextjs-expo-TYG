import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  defaultMemberPublicAlias,
  defaultPropertyPublicAlias,
} from "@tour/shared";
import {
  AdminAuthError,
  propertySessionKeys,
  requireAdminContext,
  type AdminCommunity,
  type AdminWorkspace,
  type PropertyTeamMember,
} from "@/lib/admin-auth";
import { requireSessionWriteAccess } from "@/lib/session-access";

const LINKABLE_SESSION_STATUSES = new Set(["scheduled", "in_progress"]);

class CheckInLinkError extends Error {
  constructor(message: string, public status: 400 | 404 | 409) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      sessionId?: string | null;
      path?: string | null;
    } | null;
    const requestedSessionId = body?.sessionId?.trim() || null;
    if (requestedSessionId && !isUuid(requestedSessionId)) {
      throw new CheckInLinkError("sessionId must be a UUID.", 400);
    }
    const requestedPath = body?.path?.trim() || null;
    if (requestedPath && !isPublicCheckInPath(requestedPath)) {
      throw new CheckInLinkError("path must start with /p/.", 400);
    }

    let workspace: AdminWorkspace;
    let sessionId: string;
    let propertyId: string;
    let agentId: string | null;

    if (requestedSessionId) {
      const access = await requireSessionWriteAccess(request, requestedSessionId);
      workspace = access.workspace;
      const { session } = access;
      if (!LINKABLE_SESSION_STATUSES.has(session.status)) {
        throw new CheckInLinkError(
          "Check-in links are only available for scheduled or in-progress sessions.",
          409,
        );
      }
      if (!session.propertyId) {
        throw new CheckInLinkError("This session is not assigned to a property.", 409);
      }
      sessionId = session.id;
      propertyId = session.propertyId;
      agentId = session.agentId ?? null;
    } else {
      workspace = await requireAdminContext(request);
      // Preallocate the eventual session row ID without creating an empty row.
      // The first lead submission persists it; every scan of this URL shares it.
      sessionId = randomUUID();
      propertyId = workspace.community.propertyTygId;
      agentId = null;
    }

    const publicPath = requestedPath
      ?? resolvePublicCheckInPath(workspace, propertyId, agentId);
    const url = new URL(
      publicPath,
      siteBaseUrl(request),
    );
    url.searchParams.set("check-in", "true");
    url.searchParams.set("sessionId", sessionId);

    return NextResponse.json(
      {
        sessionId,
        url: url.toString(),
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const status =
      error instanceof AdminAuthError
        ? error.status
        : error instanceof CheckInLinkError
          ? error.status
          : 500;
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Could not create the session check-in link.",
      },
      { status },
    );
  }
}

function resolveSessionMember(
  workspace: AdminWorkspace,
  community: AdminCommunity,
  agentId: string | null | undefined,
): PropertyTeamMember | null {
  const agentKey = normalizeAgentKey(agentId);
  if (agentKey) {
    const assigned = community.teamMembers.find((member) =>
      memberKeys(member).includes(agentKey),
    );
    if (assigned) return assigned;
  }

  if (agentId?.trim()) return null;
  return community.teamMembers.find((member) =>
    member.userId === workspace.user.id
    || member.email.toLowerCase() === workspace.user.email.toLowerCase()
  ) ?? null;
}

function resolvePublicCheckInPath(
  workspace: AdminWorkspace,
  propertyId: string,
  agentId: string | null | undefined,
): string {
  const community = workspace.communities.find((candidate) =>
    propertySessionKeys(candidate).includes(propertyId),
  );
  if (!community) {
    throw new CheckInLinkError("The session property is not available.", 404);
  }
  const member = resolveSessionMember(workspace, community, agentId);
  const propertySlug = defaultPropertyPublicAlias({
    alias: community.alias,
    name: community.name,
    propertyTygId: community.propertyTygId,
  });
  if (!propertySlug) throw new CheckInLinkError("Could not build the public check-in URL.", 409);
  if (!member) return `/p/${encodeURIComponent(propertySlug)}`;

  const memberSlug = defaultMemberPublicAlias({
    alias: member.alias,
    name: member.name,
    email: member.email,
    id: member.id || member.userId,
  });
  if (!memberSlug) {
    throw new CheckInLinkError("Could not build the public check-in URL.", 409);
  }
  return `/p/${encodeURIComponent(propertySlug)}/${encodeURIComponent(memberSlug)}`;
}

function memberKeys(member: PropertyTeamMember): string[] {
  const emailLocal = member.email.split("@")[0] ?? "";
  return [member.id, member.alias, member.userId, emailLocal]
    .map(normalizeAgentKey)
    .filter((value): value is string => Boolean(value));
}

function normalizeAgentKey(value: string | null | undefined): string | null {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^user:/, "")
    .replace(/^@/, "");
  return normalized || null;
}

function siteBaseUrl(request: Request): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      // Fall back to the request origin for malformed local configuration.
    }
  }
  return new URL(new URL(request.url).origin);
}

function isPublicCheckInPath(value: string): boolean {
  if (!value.startsWith("/p/") || value.startsWith("//") || value.includes("\\")) {
    return false;
  }
  try {
    const parsed = new URL(value, "https://tour.invalid");
    return (
      parsed.origin === "https://tour.invalid"
      && parsed.pathname.startsWith("/p/")
    );
  } catch {
    return false;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
