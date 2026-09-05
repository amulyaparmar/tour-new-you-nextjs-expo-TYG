// Roleplay practice-attempt persistence.
// GET  /api/roleplay/attempts            -> { success, attempts } (current property, newest first;
//                                           ?scope=mine (default) limits to the signed-in agent,
//                                           ?scope=team shows the whole property)
// GET  /api/roleplay/attempts?id=<uuid>  -> { success, attempt }  (full row incl. transcript_json)
// POST /api/roleplay/attempts            -> { success, attempt }
// DELETE /api/roleplay/attempts?id=<uuid> -> { success }
//   body: { vapiCallId, scenarioId?, scenarioName?, scenarioDifficulty?, score?,
//           gradeStatus?, durationSeconds?, summary?, transcript?, transcriptJson?, evaluations? }
//
// Auth is STRICT (requireRoleplayWorkspace — no demo fallback; the roleplay UI
// is behind the login-gated /new page). Identity is stamped SERVER-SIDE:
// property_id = workspace.community.propertyTygId, agent_id =
// `user:<auth uuid>`, agent_name from the signed-in profile. The client never
// supplies identity.

import { NextRequest, NextResponse } from "next/server";

import { requireRoleplayWorkspace } from "@/lib/roleplay/apiAuth";
import {
  deleteRoleplayAttempt,
  getRoleplayAttempt,
  listRoleplayAttempts,
  saveRoleplayAttempt,
} from "@/lib/roleplay/roleplayAttempts";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET(request: NextRequest) {
  try {
    const { workspace, response } = await requireRoleplayWorkspace(request);
    if (!workspace) return response;

    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const attempt = await getRoleplayAttempt(id);
      const accessible = new Set(
        (workspace.communities ?? []).map((community) => community.propertyTygId)
      );
      if (!attempt || (attempt.property_id && !accessible.has(attempt.property_id))) {
        return json({ success: false, message: "Attempt not found." }, 404);
      }
      return json({ success: true, attempt });
    }

    // Listing scopes to the CURRENT property so the history below the
    // scenario list matches the workspace switcher, like the session lists.
    // Default lens is the signed-in agent's own attempts; ?scope=team widens
    // to the whole property (peer visibility is a feature, not a leak).
    const scope = request.nextUrl.searchParams.get("scope") === "team" ? "team" : "mine";
    const attempts = await listRoleplayAttempts({
      propertyIds: [workspace.community.propertyTygId],
      agentId: scope === "mine" ? `user:${workspace.user.id}` : undefined,
      limit: 100,
    });
    return json({ success: true, attempts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load attempts.";
    console.error("roleplay attempts GET failed:", message);
    return json({ success: false, message }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const { workspace, response } = await requireRoleplayWorkspace(request);
    if (!workspace) return response;

    const body = await request.json();
    const vapiCallId = String(body?.vapiCallId ?? "").trim();
    if (!vapiCallId) {
      return json({ success: false, message: "vapiCallId is required." }, 400);
    }

    const finiteOrNull = (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const textOrNull = (value: unknown) => {
      const text = String(value ?? "").trim();
      return text ? text : null;
    };

    const attempt = await saveRoleplayAttempt({
      vapiCallId,
      agentId: `user:${workspace.user.id}`,
      agentName:
        workspace.user.fullName ?? workspace.teamMember.name ?? workspace.user.email ?? null,
      propertyId: workspace.community.propertyTygId,
      scenarioId: textOrNull(body?.scenarioId),
      scenarioName: textOrNull(body?.scenarioName),
      scenarioDifficulty: textOrNull(body?.scenarioDifficulty),
      score: finiteOrNull(body?.score),
      gradeStatus: ["passed", "not-passed", "needs-review"].includes(body?.gradeStatus)
        ? body.gradeStatus
        : null,
      durationSeconds: finiteOrNull(body?.durationSeconds),
      summary: textOrNull(body?.summary),
      transcript: textOrNull(body?.transcript),
      transcriptJson: Array.isArray(body?.transcriptJson) ? body.transcriptJson : [],
      evaluations: Array.isArray(body?.evaluations) ? body.evaluations : [],
    });
    return json({ success: true, attempt }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save attempt.";
    console.error("roleplay attempts POST failed:", message);
    return json({ success: false, message }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { workspace, response } = await requireRoleplayWorkspace(request);
    if (!workspace) return response;

    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) return json({ success: false, message: "id is required." }, 400);

    const attempt = await getRoleplayAttempt(id);
    const accessible = new Set(
      (workspace.communities ?? []).map((community) => community.propertyTygId)
    );
    if (!attempt || (attempt.property_id && !accessible.has(attempt.property_id))) {
      return json({ success: false, message: "Attempt not found." }, 404);
    }

    await deleteRoleplayAttempt(id);
    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete attempt.";
    console.error("roleplay attempts DELETE failed:", message);
    return json({ success: false, message }, 500);
  }
}
