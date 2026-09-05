// Persistence for graded roleplay practice attempts (`roleplay_attempts`).
//
// A dedicated table rather than a sessions row: roleplay attempts carry a
// scorecard format (waypoints, checkpoint evidence, feedback moments) that the
// sessions/analyses pipeline can't render, and rows in `sessions` would leak
// into the tour lists. agent_id / property_id follow the sessions conventions
// exactly: property_id = workspace.community.propertyTygId, agent_id =
// `user:<auth uuid>` (free-form text, same as sessions.agent_id post-FK-drop).
//
// SERVER-ONLY: import from API routes only.

import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase";

const TABLE = "roleplay_attempts";

export type RoleplayAttemptRow = {
  id: string;
  created_at: string;
  agent_id: string | null;
  agent_name: string | null;
  property_id: string | null;
  scenario_id: string | null;
  scenario_name: string | null;
  scenario_difficulty: string | null;
  vapi_call_id: string;
  score: number | null;
  grade_status: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  transcript_json: unknown[];
  evaluations: unknown[];
};

const LIST_COLUMNS =
  "id,created_at,agent_id,agent_name,property_id,scenario_id,scenario_name,scenario_difficulty,vapi_call_id,score,grade_status,duration_seconds,summary,evaluations";

// Only dress a Supabase error up as "run the migration" when it actually
// looks like a missing table (adversarial-review finding: wrapping every
// error in that hint turns ordinary failures into misleading 500s).
const storeError = (message: string) =>
  /schema cache|does not exist|relation/i.test(message)
    ? new Error(
        `roleplay_attempts unavailable (${message}) — has the create_roleplay_tables migration been applied?`
      )
    : new Error(message);

export type SaveRoleplayAttemptInput = {
  vapiCallId: string;
  agentId: string | null;
  agentName: string | null;
  propertyId: string | null;
  scenarioId: string | null;
  scenarioName: string | null;
  scenarioDifficulty: string | null;
  score: number | null;
  gradeStatus: string | null;
  durationSeconds: number | null;
  summary: string | null;
  transcript: string | null;
  transcriptJson: unknown[];
  evaluations: unknown[];
};

export async function saveRoleplayAttempt(
  input: SaveRoleplayAttemptInput
): Promise<RoleplayAttemptRow> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        vapi_call_id: input.vapiCallId,
        agent_id: input.agentId,
        agent_name: input.agentName,
        property_id: input.propertyId,
        scenario_id: input.scenarioId,
        scenario_name: input.scenarioName,
        scenario_difficulty: input.scenarioDifficulty,
        score: input.score,
        grade_status: input.gradeStatus,
        duration_seconds: input.durationSeconds,
        summary: input.summary,
        transcript: input.transcript,
        transcript_json: input.transcriptJson,
        evaluations: input.evaluations,
      } as never,
      { onConflict: "vapi_call_id" }
    )
    .select("*")
    .single();
  if (error) throw storeError(error.message);
  return data as unknown as RoleplayAttemptRow;
}

export async function listRoleplayAttempts(params: {
  propertyIds: string[];
  // When set, only this agent's attempts (the "Mine" scope) — e.g. `user:<uuid>`.
  agentId?: string;
  limit?: number;
}): Promise<RoleplayAttemptRow[]> {
  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from(TABLE)
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, params.limit ?? 100)));
  if (params.propertyIds.length > 0) {
    query = query.in("property_id", params.propertyIds);
  }
  if (params.agentId) {
    query = query.eq("agent_id", params.agentId);
  }
  const { data, error } = await query;
  if (error) throw storeError(error.message);
  return (data ?? []) as unknown as RoleplayAttemptRow[];
}

// Fetches by id alone; the route authorizes against the workspace's
// accessible properties in code (a `.in()` filter with a global admin's
// thousands of property ids would ride the PostgREST query string).
export async function getRoleplayAttempt(id: string): Promise<RoleplayAttemptRow | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw storeError(error.message);
  return (data as unknown as RoleplayAttemptRow) ?? null;
}

export async function deleteRoleplayAttempt(id: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw storeError(error.message);
}
