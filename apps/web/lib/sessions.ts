import "server-only";

import type {
  AnalysisResult,
  AnalysisRun,
  AnalysisRunSummary,
  AnalysisRunTrigger,
  AudioInsights,
  AudioInsightsStatus,
  ConversationPhaseSegmentation,
  CreateSessionInput,
  FollowUpAction,
  SessionDetail,
  SessionAttachment,
  SessionLead,
  SessionKind,
  SessionCustomerInterest,
  SessionSource,
  SessionStatus,
  SessionSummary
} from "@tour/shared";
import { normalizeAudioInsights, normalizeAudioInsightsStatus, normalizeConversationPhaseSegmentation, normalizeParticipantName, normalizeSessionCustomerInterests, normalizeSessionKind, normalizeSessionStatus, buildSessionTourTitle } from "@tour/shared";

import {
  addLocalSessionLead,
  addLocalSessionAttachment,
  createLocalSession,
  deleteLocalSession,
  getLocalAnalysis,
  getLocalAnalysisRun,
  getLocalAudioInsights,
  getLocalConversationPhases,
  getLocalSessionById,
  getLocalTranscript,
  listLocalActions,
  listLocalAnalysisRuns,
  listLocalSessions,
  replaceLocalActions,
  recordLocalWorkflowCompleted,
  recordLocalWorkflowFailed,
  recordLocalWorkflowStarted,
  saveLocalAnalysisRun,
  saveLocalAudioInsights,
  saveLocalConversationPhases,
  saveLocalTranscript,
  setLocalAudioInsightsStatus,
  clearLocalAudioInsights,
  setLocalSessionStatus,
  updateLocalActionStatus,
  updateLocalSession,
  updateLocalSessionLeadNotes,
} from "./local-store";
import { getSupabaseServiceClient } from "./supabase";
import { getPrimaryRubricForProperty } from "./rubrics";

function rethrowInProduction(error: unknown): void {
  if (process.env.NODE_ENV === "production") {
    throw error;
  }
}

function shouldUseLocalStoreFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

type SessionRow = {
  id: string;
  title: string;
  prospect_name: string | null;
  agent_name: string | null;
  scheduled_at: string | null;
  location: string | null;
  status: SessionStatus;
  source: SessionSource | null;
  session_kind?: string | null;
  leads: SessionLead[] | null;
  attachments: SessionAttachment[] | null;
  customer_interests?: SessionCustomerInterest[] | null;
  rubric_id: string | null;
  agent_id?: string | null;
  property_id?: string | null;
  unit_label?: string | null;
  external_provider?: string | null;
  external_event_id?: string | null;
  external_application_id?: string | null;
  overall_score: number | null;
  notes: string | null;
  video_url: string | null;
  audio_url: string | null;
  duration: number | null;
  created_at: string;
  audio_insights_status: AudioInsightsStatus | null;
  analysis_workflow_run_id?: string | null;
  analysis_workflow_started_at?: string | null;
  analysis_workflow_completed_at?: string | null;
  analysis_workflow_error?: string | null;
  analysis_workflow_attempts?: number | null;
  audio_insights_workflow_run_id?: string | null;
  audio_insights_started_at?: string | null;
  audio_insights_completed_at?: string | null;
  audio_insights_error?: string | null;
  audio_insights_attempts?: number | null;
  card_summary?: string | null;
  needs_improvement?: string | null;
};

const SESSION_COLUMNS =
  "id,title,prospect_name,agent_name,scheduled_at,location,status,source,session_kind,leads,attachments,customer_interests,rubric_id,agent_id,property_id,unit_label,external_provider,external_event_id,external_application_id,overall_score,notes,video_url,audio_url,duration,created_at,audio_insights_status,analysis_workflow_run_id,analysis_workflow_started_at,analysis_workflow_completed_at,analysis_workflow_error,analysis_workflow_attempts,audio_insights_workflow_run_id,audio_insights_started_at,audio_insights_completed_at,audio_insights_error,audio_insights_attempts,card_summary,needs_improvement";

// Keep the sessions index readable while newer workflow/identity migrations are
// still being rolled out. These optional fields are not used by the list UI.
const SESSION_READ_COLUMNS =
  "id,title,prospect_name,agent_name,scheduled_at,location,status,source,session_kind,leads,attachments,customer_interests,rubric_id,agent_id,property_id,unit_label,external_provider,external_event_id,external_application_id,overall_score,notes,video_url,audio_url,duration,created_at,audio_insights_status,analysis_workflow_run_id,analysis_workflow_started_at,analysis_workflow_completed_at,analysis_workflow_error,analysis_workflow_attempts,audio_insights_workflow_run_id,audio_insights_started_at,audio_insights_completed_at,audio_insights_error,audio_insights_attempts,card_summary,needs_improvement";

export type SessionWorkflowKind = "analysis" | "audioInsights";

type AnalysisRow = {
  id: string;
  session_id: string;
  status: "processing" | "ready" | "failed";
  result_json: AnalysisResult;
  created_at: string;
  version?: number | null;
  is_current?: boolean | null;
  rubric_id?: string | null;
  rubric_name?: string | null;
  trigger?: string | null;
};

function mapAnalysisRunSummary(row: AnalysisRow): AnalysisRunSummary {
  return {
    id: row.id,
    sessionId: row.session_id,
    version: row.version ?? 1,
    isCurrent: row.is_current ?? true,
    overallScore: row.result_json.overallScore,
    rubricId: row.rubric_id ?? null,
    rubricName: row.rubric_name ?? null,
    trigger: row.trigger === "initial" || row.trigger === "reanalyze" ? row.trigger : null,
    createdAt: row.created_at,
  };
}

function mapAnalysisRun(row: AnalysisRow): AnalysisRun {
  return {
    ...mapAnalysisRunSummary(row),
    result: row.result_json,
  };
}

function resolveVersionFilter(version?: string | null) {
  if (!version) return null;
  const uuidPattern = /^[0-9a-f-]{36}$/i;
  if (uuidPattern.test(version)) {
    return { kind: "id" as const, value: version };
  }
  const versionNumber = Number(version);
  if (!Number.isNaN(versionNumber) && versionNumber > 0) {
    return { kind: "version" as const, value: versionNumber };
  }
  return null;
}

type FollowUpActionRow = {
  id: string;
  session_id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "completed" | "dismissed";
  suggested_message: string | null;
  created_at: string;
};

export type ListSessionsParams = {
  page?: number;
  limit?: number;
  status?: SessionStatus;
  statuses?: SessionStatus[];
  search?: string;
  sort?: "newest" | "oldest" | "score_desc" | "score_asc" | "scheduled_asc";
  propertyId?: string;
  propertyIds?: string[];
  agentId?: string;
  sessionKind?: SessionKind;
  excludeScheduled?: boolean;
  upcomingFrom?: string;
};

export type PaginatedSessions = {
  sessions: SessionSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export async function listSessions(params?: ListSessionsParams): Promise<SessionSummary[]> {
  const result = await listSessionsPaginated(params);
  return result.sessions;
}

export async function listSessionsPaginated(params?: ListSessionsParams): Promise<PaginatedSessions> {
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(100, Math.max(1, params?.limit ?? 20));
  const offset = (page - 1) * limit;

  try {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from("sessions")
      .select(SESSION_READ_COLUMNS, { count: "exact" });

    if (params?.status) {
      query = query.eq("status", params.status);
    } else if (params?.statuses?.length) {
      query = query.in("status", params.statuses);
    }

    if (params?.excludeScheduled) {
      query = query.neq("status", "scheduled");
    }
    if (params?.upcomingFrom) {
      query = query.or(
        `status.eq.in_progress,and(status.eq.scheduled,scheduled_at.gte.${params.upcomingFrom})`
      );
    }

    if (params?.propertyId) {
      query = query.eq("property_id", params.propertyId);
    } else if (params?.propertyIds?.length) {
      query = query.in("property_id", params.propertyIds);
    }

    if (params?.agentId) {
      query = query.eq("agent_id", params.agentId);
    }
    if (params?.sessionKind) {
      query = query.eq("session_kind", params.sessionKind);
    }

    if (params?.search) {
      const term = `%${params.search}%`;
      query = query.or(`title.ilike.${term},prospect_name.ilike.${term},location.ilike.${term}`);
    }

    const sort = params?.sort ?? "newest";
    switch (sort) {
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "score_desc":
        query = query.order("overall_score", { ascending: false, nullsFirst: false });
        break;
      case "score_asc":
        query = query.order("overall_score", { ascending: true, nullsFirst: false });
        break;
      case "scheduled_asc":
        query = query.order("scheduled_at", { ascending: true, nullsFirst: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const sessions = (data ?? []).map(mapSessionRow);
    if (params?.sort === "scheduled_asc") {
      sessions.sort((a, b) => {
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        return new Date(a.scheduledAt ?? a.createdAt).getTime() - new Date(b.scheduledAt ?? b.createdAt).getTime();
      });
    }
    const total = count ?? sessions.length;

    return { sessions, total, page, limit, hasMore: offset + sessions.length < total };
  } catch (error) {
    rethrowInProduction(error);
    let all = await listLocalSessions();

    if (params?.excludeScheduled) {
      all = all.filter((session) => session.status !== "scheduled");
    }
    if (params?.upcomingFrom) {
      const cutoff = new Date(params.upcomingFrom).getTime();
      all = all.filter((session) =>
        session.status === "in_progress" ||
        (
          session.status === "scheduled" &&
          session.scheduledAt !== null &&
          new Date(session.scheduledAt).getTime() >= cutoff
        )
      );
    }
    if (params?.status) {
      all = all.filter((session) => session.status === params.status);
    } else if (params?.statuses?.length) {
      all = all.filter((session) => params.statuses!.includes(session.status));
    }
    if (params?.propertyId) {
      all = all.filter((session) => session.propertyId === params.propertyId);
    } else if (params?.propertyIds?.length) {
      all = all.filter((session) => session.propertyId && params.propertyIds!.includes(session.propertyId));
    }
    if (params?.agentId) {
      all = all.filter((session) => session.agentId === params.agentId);
    }
    if (params?.sessionKind) {
      all = all.filter((session) => session.sessionKind === params.sessionKind);
    }
    if (params?.search) {
      const term = params.search.toLowerCase();
      all = all.filter((session) =>
        session.title.toLowerCase().includes(term) ||
        session.prospectName?.toLowerCase().includes(term) ||
        session.location?.toLowerCase().includes(term)
      );
    }

    if (params?.sort === "scheduled_asc") {
      all.sort((a, b) => {
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        return new Date(a.scheduledAt ?? a.createdAt).getTime() - new Date(b.scheduledAt ?? b.createdAt).getTime();
      });
    }

    const total = all.length;
    const offset = (page - 1) * limit;
    const sessions = all.slice(offset, offset + limit);
    return { sessions, total, page, limit, hasMore: offset + sessions.length < total };
  }
}

export async function createSession(input: CreateSessionInput): Promise<SessionSummary> {
  const prospectName = normalizeParticipantName(
    input.prospectName ?? input.leads?.[0]?.name ?? null,
  );
  const agentName = normalizeParticipantName(input.agentName);
  const normalizedTitle = buildSessionTourTitle({
    title: input.title ?? null,
    agentName,
    prospectName,
  });

  if (!normalizedTitle) {
    throw new Error("Session title is required.");
  }

  const rubricId = input.rubricId ?? (
    input.propertyId ? (await getPrimaryRubricForProperty(input.propertyId)).id : null
  );
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    title: normalizedTitle,
    status: input.status ?? "scheduled",
    scheduled_at: input.scheduledAt ?? null,
    location: input.location?.trim() ? input.location.trim() : null,
    prospect_name: prospectName,
    agent_name: agentName,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    source: input.source ?? "manual",
    session_kind: input.sessionKind ?? "tour",
    leads: input.leads ?? [],
    attachments: input.attachments ?? [],
    customer_interests: normalizeSessionCustomerInterests(input.customerInterests),
    rubric_id: rubricId,
    agent_id: input.agentId ?? null,
    property_id: input.propertyId ?? null,
    unit_label: input.unitLabel ?? null
  };

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sessions")
      .insert(payload as never)
      .select(SESSION_COLUMNS)
      .single<SessionRow>();

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message ?? "Unknown error"}`);
    }

    const created = mapSessionRow(data);
    if (
      created.propertyId
      && (created.source !== "qr" || created.leads.length > 0)
    ) {
      void import("./push")
        .then(({ notifyNewSession }) =>
          notifyNewSession({
            propertyId: created.propertyId!,
            sessionId: created.id,
            title: created.title,
            agentId: created.agentId,
            source: created.source,
            autoStartRecording: created.source === "qr",
          }),
        )
        .catch(() => {});
    }
    return created;
  } catch (error) {
    rethrowInProduction(error);
    return createLocalSession({
      id: input.id,
      title: normalizedTitle,
      status: input.status ?? "scheduled",
      scheduledAt: input.scheduledAt ?? null,
      location: input.location ?? null,
      prospectName,
      agentName,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      sessionKind: input.sessionKind ?? "tour",
      leads: input.leads ?? [],
      attachments: input.attachments ?? [],
      customerInterests: normalizeSessionCustomerInterests(input.customerInterests),
      rubricId,
      agentId: input.agentId ?? null,
      propertyId: input.propertyId ?? null,
    });
  }
}

export async function addSessionLead(sessionId: string, lead: SessionLead): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.rpc("append_session_check_in" as never, {
      p_session_id: sessionId,
      p_lead: lead,
    } as never);
    if (error) throw new Error(error.message);
  } catch (error) {
    rethrowInProduction(error);
    await addLocalSessionLead(sessionId, lead);
  }
}

export async function addSessionAttachment(sessionId: string, attachment: SessionAttachment): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.rpc("append_session_attachment" as never, {
      p_session_id: sessionId,
      p_attachment: attachment,
    } as never);
    if (error) throw new Error(error.message);
  } catch (error) {
    rethrowInProduction(error);
    await addLocalSessionAttachment(sessionId, attachment);
  }
}

export async function updateSessionLeadNotes(sessionId: string, createdAt: string, notes: string | null): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.rpc("update_session_lead_notes" as never, {
      p_session_id: sessionId,
      p_created_at: createdAt,
      p_notes: notes,
    } as never);
    if (error) throw new Error(error.message);
  } catch (error) {
    rethrowInProduction(error);
    await updateLocalSessionLeadNotes(sessionId, createdAt, notes);
  }
}

export async function updateSession(
  sessionId: string,
  fields: {
    title?: string;
    scheduledAt?: string | null;
    prospectName?: string | null;
    agentName?: string | null;
    location?: string | null;
    notes?: string | null;
    customerInterests?: SessionCustomerInterest[];
    videoUrl?: string | null;
    audioUrl?: string | null;
    duration?: number | null;
    rubricId?: string | null;
    agentId?: string | null;
    propertyId?: string | null;
    unitLabel?: string | null;
  }
) {
  try {
    const supabase = getSupabaseServiceClient();
    const row: Record<string, unknown> = {};
    if (fields.title !== undefined) row.title = fields.title;
    if (fields.scheduledAt !== undefined) row.scheduled_at = fields.scheduledAt;
    if (fields.prospectName !== undefined) row.prospect_name = normalizeParticipantName(fields.prospectName);
    if (fields.agentName !== undefined) row.agent_name = normalizeParticipantName(fields.agentName);
    if (fields.location !== undefined) row.location = fields.location;
    if (fields.notes !== undefined) row.notes = fields.notes;
    if (fields.customerInterests !== undefined) {
      row.customer_interests = normalizeSessionCustomerInterests(fields.customerInterests);
    }
    if (fields.videoUrl !== undefined) row.video_url = fields.videoUrl;
    if (fields.audioUrl !== undefined) row.audio_url = fields.audioUrl;
    if (fields.duration !== undefined) row.duration = fields.duration;
    if (fields.rubricId !== undefined) row.rubric_id = fields.rubricId;
    if (fields.agentId !== undefined) row.agent_id = fields.agentId;
    if (fields.propertyId !== undefined) row.property_id = fields.propertyId;
    if (fields.unitLabel !== undefined) row.unit_label = fields.unitLabel;

    const { error } = await supabase.from("sessions").update(row as never).eq("id", sessionId);
    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await updateLocalSession(sessionId, {
      ...fields,
      prospectName: fields.prospectName === undefined ? undefined : normalizeParticipantName(fields.prospectName),
      agentName: fields.agentName === undefined ? undefined : normalizeParticipantName(fields.agentName),
    });
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  } catch (error) {
    rethrowInProduction(error);
    await deleteLocalSession(sessionId);
  }
}

export async function getSessionById(sessionId: string): Promise<SessionDetail | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_READ_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle<SessionRow>();

    if (error) {
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapSessionDetailRow(data);
  } catch (error) {
    rethrowInProduction(error);
    return getLocalSessionById(sessionId);
  }
}

export async function listAnalysisRuns(sessionId: string): Promise<AnalysisRunSummary[]> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("analyses")
      .select("id,session_id,status,result_json,created_at,version,is_current,rubric_id,rubric_name,trigger")
      .eq("session_id", sessionId)
      .order("version", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return ((data as AnalysisRow[] | null) ?? []).map(mapAnalysisRunSummary);
  } catch (error) {
    rethrowInProduction(error);
    return listLocalAnalysisRuns(sessionId);
  }
}

export async function getAnalysisRun(
  sessionId: string,
  version?: string | null
): Promise<AnalysisRun | null> {
  const filter = resolveVersionFilter(version);

  try {
    const supabase = getSupabaseServiceClient();

    if (filter?.kind === "id") {
      const { data, error } = await supabase
        .from("analyses")
        .select("id,session_id,status,result_json,created_at,version,is_current,rubric_id,rubric_name,trigger")
        .eq("session_id", sessionId)
        .eq("id", filter.value)
        .maybeSingle<AnalysisRow>();
      if (error) throw new Error(error.message);
      if (data) return mapAnalysisRun(data);
    } else if (filter?.kind === "version") {
      const { data, error } = await supabase
        .from("analyses")
        .select("id,session_id,status,result_json,created_at,version,is_current,rubric_id,rubric_name,trigger")
        .eq("session_id", sessionId)
        .eq("version", filter.value)
        .maybeSingle<AnalysisRow>();
      if (error) throw new Error(error.message);
      if (data) return mapAnalysisRun(data);
    } else {
      const { data, error } = await supabase
        .from("analyses")
        .select("id,session_id,status,result_json,created_at,version,is_current,rubric_id,rubric_name,trigger")
        .eq("session_id", sessionId)
        .eq("is_current", true)
        .order("version", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const row = (data as AnalysisRow[] | null)?.[0];
      if (row) return mapAnalysisRun(row);
    }
  } catch (error) {
    rethrowInProduction(error);
    return getLocalAnalysisRun(sessionId, version);
  }

  return null;
}

export async function getAnalysisBySessionId(
  sessionId: string,
  version?: string | null
): Promise<AnalysisResult | null> {
  if (version) {
    return (await getAnalysisRun(sessionId, version))?.result ?? null;
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("analyses")
      .select("id,session_id,status,result_json,created_at,version,is_current,rubric_id,rubric_name,trigger")
      .eq("session_id", sessionId)
      .eq("is_current", true)
      .order("version", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch analysis: ${error.message}`);
    }

    return ((data as AnalysisRow[] | null)?.[0]?.result_json) ?? null;
  } catch (error) {
    rethrowInProduction(error);
    return getLocalAnalysis(sessionId);
  }
}

export async function saveAnalysisRun(
  sessionId: string,
  analysis: AnalysisResult,
  meta?: {
    rubricId?: string | null;
    rubricName?: string | null;
    trigger?: AnalysisRunTrigger;
  }
): Promise<{ runId: string; version: number }> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase.rpc("save_analysis_run", {
      p_session_id: sessionId,
      p_result_json: analysis,
      p_rubric_id: meta?.rubricId ?? null,
      p_rubric_name: meta?.rubricName ?? null,
      p_trigger: meta?.trigger ?? null,
    } as never);

    if (error) {
      throw new Error(`Failed to save analysis: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as {
      run_id?: string;
      version?: number;
    } | null;
    if (!row?.run_id || typeof row.version !== "number") {
      throw new Error("Analysis save did not return a run id and version.");
    }

    return { runId: row.run_id, version: row.version };
  } catch (error) {
    rethrowInProduction(error);
    return saveLocalAnalysisRun(sessionId, analysis, meta);
  }
}

export async function upsertAnalysis(
  sessionId: string,
  analysis: AnalysisResult,
  meta?: {
    rubricId?: string | null;
    rubricName?: string | null;
    trigger?: AnalysisRunTrigger;
  }
): Promise<AnalysisResult> {
  await saveAnalysisRun(sessionId, analysis, meta);
  return analysis;
}

export async function listFollowUpActions(sessionId: string): Promise<FollowUpAction[]> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("follow_up_actions")
      .select("id,session_id,title,description,priority,status,suggested_message,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list actions: ${error.message}`);
    }

    return ((data as FollowUpActionRow[] | null) ?? []).map(mapFollowUpActionRow);
  } catch (error) {
    rethrowInProduction(error);
    return listLocalActions(sessionId);
  }
}

export async function replaceFollowUpActions(
  sessionId: string,
  actions: Array<Omit<FollowUpAction, "id" | "sessionId" | "createdAt">>
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();

    const { error: deleteError } = await supabase
      .from("follow_up_actions")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) {
      throw new Error(`Failed to clear existing actions: ${deleteError.message}`);
    }

    if (actions.length === 0) {
      return;
    }

    const insertRows = actions.map((action) => ({
      session_id: sessionId,
      title: action.title,
      description: action.description,
      priority: action.priority,
      status: action.status,
      suggested_message: action.suggestedMessage
    }));

    const { error: insertError } = await supabase
      .from("follow_up_actions")
      .insert(insertRows as never);

    if (insertError) {
      throw new Error(`Failed to insert actions: ${insertError.message}`);
    }
  } catch (error) {
    rethrowInProduction(error);
    await replaceLocalActions(sessionId, actions);
  }
}

export async function updateFollowUpActionStatus(
  actionId: string,
  status: FollowUpAction["status"]
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("follow_up_actions")
      .update({ status } as never)
      .eq("id", actionId);

    if (error) {
      throw new Error(`Failed to update action status: ${error.message}`);
    }
  } catch (error) {
    rethrowInProduction(error);
    await updateLocalActionStatus(actionId, status);
  }
}

export async function setSessionStatus(
  sessionId: string,
  status: SessionStatus,
  overallScore?: number
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    const patch =
      typeof overallScore === "number"
        ? ({ status, overall_score: overallScore } as const)
        : ({ status } as const);
    const { error } = await supabase
      .from("sessions")
      .update(patch as never)
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to set session status: ${error.message}`);
    }

    if (status === "analysis_ready") {
      void (async () => {
        try {
          const session = await getSessionById(sessionId);
          if (!session) return;
          const { notifyAnalysisReady } = await import("./push");
          await notifyAnalysisReady({
            agentId: session.agentId,
            sessionId,
            title: session.title,
            overallScore: typeof overallScore === "number" ? overallScore : session.overallScore,
            propertyId: session.propertyId,
          });
        } catch {
          // Ignore push failures.
        }
      })();
    }
  } catch (error) {
    rethrowInProduction(error);
    await setLocalSessionStatus(sessionId, status, overallScore);
  }
}

export async function recordSessionWorkflowStarted(
  sessionId: string,
  kind: SessionWorkflowKind,
  runId: string | null
): Promise<void> {
  const now = new Date().toISOString();
  const patch = kind === "analysis"
    ? {
        analysis_workflow_run_id: runId,
        analysis_workflow_started_at: now,
        analysis_workflow_completed_at: null,
        analysis_workflow_error: null,
      }
    : {
        audio_insights_workflow_run_id: runId,
        audio_insights_started_at: now,
        audio_insights_completed_at: null,
        audio_insights_error: null,
      };

  try {
    const supabase = getSupabaseServiceClient();
    const attemptColumn = kind === "analysis"
      ? "analysis_workflow_attempts"
      : "audio_insights_attempts";
    const { data: existing } = await supabase
      .from("sessions")
      .select(attemptColumn)
      .eq("id", sessionId)
      .single<Record<string, number | null>>();
    const attempts = Math.max(0, Number(existing?.[attemptColumn] ?? 0)) + 1;
    const { error } = await supabase
      .from("sessions")
      .update({ ...patch, [attemptColumn]: attempts } as never)
      .eq("id", sessionId);
    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await recordLocalWorkflowStarted(sessionId, kind, runId);
  }
}

export async function recordSessionWorkflowCompleted(
  sessionId: string,
  kind: SessionWorkflowKind
): Promise<void> {
  const now = new Date().toISOString();
  const patch = kind === "analysis"
    ? {
        analysis_workflow_completed_at: now,
        analysis_workflow_error: null,
      }
    : {
        audio_insights_completed_at: now,
        audio_insights_error: null,
      };

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("sessions")
      .update(patch as never)
      .eq("id", sessionId);
    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await recordLocalWorkflowCompleted(sessionId, kind);
  }
}

export async function recordSessionWorkflowFailed(
  sessionId: string,
  kind: SessionWorkflowKind,
  errorMessage: string
): Promise<void> {
  const patch = kind === "analysis"
    ? { analysis_workflow_error: errorMessage }
    : { audio_insights_error: errorMessage };

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("sessions")
      .update(patch as never)
      .eq("id", sessionId);
    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await recordLocalWorkflowFailed(sessionId, kind, errorMessage);
  }
}

export type StoredTranscriptSegment = {
  id: string;
  sessionId: string;
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
};

export async function saveTranscript(sessionId: string, segments: StoredTranscriptSegment[]) {
  try {
    const supabase = getSupabaseServiceClient();
    const json = segments.map((seg) => ({
      speaker: seg.speaker,
      startTime: seg.startTime,
      endTime: seg.endTime,
      text: seg.text
    }));

    const { error } = await supabase
      .from("sessions")
      .update({ transcript_json: json } as never)
      .eq("id", sessionId);

    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await saveLocalTranscript(sessionId, segments);
  }
}

export async function getTranscript(sessionId: string): Promise<StoredTranscriptSegment[]> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sessions")
      .select("transcript_json")
      .eq("id", sessionId)
      .single<{ transcript_json: Array<{ speaker: string; startTime: number; endTime: number; text: string }> }>();

    if (error) throw error;

    const arr = data?.transcript_json ?? [];
    if (arr.length > 0) {
      return arr.map((seg, i) => ({
        id: `${sessionId}-t${i}`,
        sessionId,
        speaker: seg.speaker,
        startTime: seg.startTime,
        endTime: seg.endTime,
        text: seg.text
      }));
    }

    return shouldUseLocalStoreFallback() ? getLocalTranscript(sessionId) : [];
  } catch (error) {
    rethrowInProduction(error);
    return getLocalTranscript(sessionId);
  }
}

export async function saveConversationPhases(
  sessionId: string,
  segmentation: ConversationPhaseSegmentation
) {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("sessions")
      .update({ conversation_phases_json: segmentation } as never)
      .eq("id", sessionId);

    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await saveLocalConversationPhases(sessionId, segmentation);
  }
}

export async function getConversationPhases(
  sessionId: string
): Promise<ConversationPhaseSegmentation | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sessions")
      .select("conversation_phases_json")
      .eq("id", sessionId)
      .single<{ conversation_phases_json: ConversationPhaseSegmentation | null }>();

    if (error) throw error;

    const raw = data?.conversation_phases_json;
    const normalized = normalizeConversationPhaseSegmentation(raw);
    if (normalized) return normalized;

    return shouldUseLocalStoreFallback()
      ? normalizeConversationPhaseSegmentation(await getLocalConversationPhases(sessionId))
      : null;
  } catch (error) {
    rethrowInProduction(error);
    return normalizeConversationPhaseSegmentation(await getLocalConversationPhases(sessionId));
  }
}

export async function saveAudioInsights(sessionId: string, insights: AudioInsights) {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("sessions")
      .update({
        audio_insights_json: insights,
        audio_insights_status: "ready",
      } as never)
      .eq("id", sessionId);

    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await saveLocalAudioInsights(sessionId, insights);
    await setLocalAudioInsightsStatus(sessionId, "ready");
  }
}

export async function clearAudioInsights(sessionId: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("sessions")
      .update({ audio_insights_json: null } as never)
      .eq("id", sessionId);

    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await clearLocalAudioInsights(sessionId);
  }
}

export async function setAudioInsightsStatus(
  sessionId: string,
  status: AudioInsightsStatus
) {
  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("sessions")
      .update({ audio_insights_status: status } as never)
      .eq("id", sessionId);

    if (error) throw error;
  } catch (error) {
    rethrowInProduction(error);
    await setLocalAudioInsightsStatus(sessionId, status);
  }
}

export async function getAudioInsights(sessionId: string): Promise<AudioInsights | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sessions")
      .select("audio_insights_json")
      .eq("id", sessionId)
      .single<{ audio_insights_json: AudioInsights | null }>();

    if (error) throw error;

    const normalized = normalizeAudioInsights(data?.audio_insights_json);
    if (normalized) return normalized;

    return shouldUseLocalStoreFallback()
      ? normalizeAudioInsights(await getLocalAudioInsights(sessionId))
      : null;
  } catch (error) {
    rethrowInProduction(error);
    return normalizeAudioInsights(await getLocalAudioInsights(sessionId));
  }
}

function mapSessionRow(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    title: row.title,
    prospectName: normalizeParticipantName(row.prospect_name),
    agentName: normalizeParticipantName(row.agent_name),
    scheduledAt: row.scheduled_at,
    location: row.location,
    status: normalizeSessionStatus(row.status),
    source: row.source ?? "manual",
    sessionKind: normalizeSessionKind(row.session_kind),
    leads: row.leads ?? [],
    attachments: row.attachments ?? [],
    customerInterests: normalizeSessionCustomerInterests(row.customer_interests),
    rubricId: row.rubric_id ?? null,
    agentId: row.agent_id ?? null,
    propertyId: row.property_id ?? null,
    unitLabel: row.unit_label ?? null,
    overallScore: row.overall_score,
    duration: row.duration,
    createdAt: row.created_at,
    audioInsightsStatus: normalizeAudioInsightsStatus(row.audio_insights_status),
    analysisWorkflowRunId: row.analysis_workflow_run_id ?? null,
    analysisWorkflowStartedAt: row.analysis_workflow_started_at ?? null,
    analysisWorkflowCompletedAt: row.analysis_workflow_completed_at ?? null,
    analysisWorkflowError: row.analysis_workflow_error ?? null,
    analysisWorkflowAttempts: row.analysis_workflow_attempts ?? 0,
    audioInsightsWorkflowRunId: row.audio_insights_workflow_run_id ?? null,
    audioInsightsStartedAt: row.audio_insights_started_at ?? null,
    audioInsightsCompletedAt: row.audio_insights_completed_at ?? null,
    audioInsightsError: row.audio_insights_error ?? null,
    audioInsightsAttempts: row.audio_insights_attempts ?? 0,
    cardSummary: row.card_summary?.trim() || null,
    needsImprovement: row.needs_improvement?.trim() || null,
  };
}

function mapSessionDetailRow(row: SessionRow): SessionDetail {
  return {
    ...mapSessionRow(row),
    notes: row.notes,
    videoUrl: row.video_url,
    audioUrl: row.audio_url,
    duration: row.duration
  };
}

function mapFollowUpActionRow(row: FollowUpActionRow): FollowUpAction {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    suggestedMessage: row.suggested_message,
    createdAt: row.created_at
  };
}
