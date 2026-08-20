import { NextResponse } from "next/server";

import { normalizeSessionCustomerInterests } from "@tour/shared";
import { requireRoleplayWorkspace } from "@/lib/roleplay/apiAuth";
import { createSession } from "@/lib/sessions";
import { getDefaultRubric, getPrimaryRubricForProperty, listRubrics } from "@/lib/rubrics";
import { normalizePhoneE164 } from "@/lib/twilio";

export const dynamic = "force-dynamic";

type CallMode = "mystery_shop" | "prospect_follow_up";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const { workspace, response: authResponse } = await requireRoleplayWorkspace(request);
    if (!workspace) return authResponse;

    const body = await request.json().catch(() => null) as {
      phoneNumber?: unknown;
      mode?: unknown;
      rubricId?: unknown;
      prospectName?: unknown;
      notes?: unknown;
    } | null;
    const phoneNumber = normalizePhoneE164(typeof body?.phoneNumber === "string" ? body.phoneNumber : null);
    if (!phoneNumber) return response({ error: "A valid property phone number is required." }, 400);

    const mode: CallMode = body?.mode === "prospect_follow_up" ? "prospect_follow_up" : "mystery_shop";
    const propertyId = workspace.community.propertyTygId;
    const rubrics = await listRubrics();
    const selectedRubric = typeof body?.rubricId === "string"
      ? rubrics.find((rubric) => rubric.id === body.rubricId && rubric.propertyId === propertyId)
      : null;
    const phoneRubric = selectedRubric ?? rubrics.find(
      (rubric) => rubric.propertyId === propertyId && rubric.sessionType === "phone_shop",
    )
      ?? rubrics.find((rubric) => !rubric.propertyId && rubric.sessionType === "phone_shop")
      // A property can use its normal/default rubric for a phone call until a
      // dedicated phone-shop rubric is configured.
      ?? await getPrimaryRubricForProperty(propertyId).catch(() => getDefaultRubric());

    const session = await createSession({
      title: mode === "mystery_shop" ? "Mystery Shop Call" : "Prospect Follow-up Call",
      status: "scheduled",
      location: workspace.community.name,
      prospectName: typeof body?.prospectName === "string" ? body.prospectName : null,
      agentName: workspace.user.fullName ?? workspace.teamMember.name,
      notes: typeof body?.notes === "string" ? body.notes : null,
      source: "manual",
      sessionKind: "ai_call",
      rubricId: phoneRubric.id,
      agentId: `user:${workspace.user.id}`,
      propertyId,
      customerInterests: normalizeSessionCustomerInterests([]),
    });

    return response({ ok: true, sessionId: session.id, phoneNumber, mode }, 201);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Could not start the phone call." }, 500);
  }
}
