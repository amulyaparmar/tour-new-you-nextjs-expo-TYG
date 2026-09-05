import type { AnalysisResult, AnalysisRunSummary, AudioInsights, AudioInsightsStatus, ConversationPhaseSegmentation, FollowUpAction, Rubric, SessionAttachment, SessionDetail, SessionLead, SessionSummary } from "@tour/shared";
import { fetch as expoFetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";

import { authenticatedFetch, getCurrentSession } from "./auth";
import { getApiBaseUrl } from "./config";
import { uploadLocalFileWithPresign, type UploadProgressInfo } from "./presignedUpload";

export type FetchSessionsParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  agentId?: string;
  sort?: "newest" | "oldest" | "score_desc" | "score_asc" | "scheduled_asc";
  upcoming?: boolean;
};

export type PaginatedSessions = {
  sessions: SessionSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type SampleSessionsResponse = {
  sample: true;
  propertyName: string;
  sessions: SessionSummary[];
};

export type SampleSessionBundle = {
  sample: true;
  propertyName: string;
  session: SessionDetail;
  analysis: AnalysisResult;
  phases: ConversationPhaseSegmentation | null;
  transcript: Array<{
    id: string;
    sessionId: string;
    speaker: string;
    startTime: number;
    endTime: number;
    text: string;
  }>;
  actions: FollowUpAction[];
};

export async function fetchSessions(params?: FetchSessionsParams): Promise<PaginatedSessions> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.status) sp.set("status", params.status);
  if (params?.search) sp.set("search", params.search);
  if (params?.agentId) sp.set("agentId", params.agentId);
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.upcoming) sp.set("upcoming", "true");
  const qs = sp.toString();
  const res = await authenticatedFetch(`/api/sessions${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error("Failed to fetch sessions.");
  }
  return (await res.json()) as PaginatedSessions;
}

export async function fetchSampleSessions(): Promise<SampleSessionsResponse> {
  const res = await authenticatedFetch("/api/sessions/samples");
  const body = await res.json().catch(() => null) as (SampleSessionsResponse & { error?: string }) | null;
  if (!res.ok || !body?.sessions) {
    throw new Error(body?.error ?? "Could not load sample sessions.");
  }
  return body;
}

export async function fetchSampleSession(sessionId: string): Promise<SampleSessionBundle> {
  const res = await authenticatedFetch(`/api/sessions/samples?id=${encodeURIComponent(sessionId)}`);
  const body = await res.json().catch(() => null) as (SampleSessionBundle & { error?: string }) | null;
  if (!res.ok || !body?.session || !body.analysis) {
    throw new Error(body?.error ?? "Could not load the sample session.");
  }
  return body;
}

export async function createSession(payload: {
  title: string;
  titleIsAuto?: boolean;
  status?: "scheduled" | "in_progress";
  source?: "manual" | "qr";
  sourceFileName?: string | null;
  scheduledAt?: string | null;
  prospectName?: string | null;
  agentName?: string | null;
  uploaderIsAgent?: boolean;
  location?: string | null;
  notes?: string | null;
  rubricId?: string | null;
}) {
  let res: Response;
  try {
    res = await authenticatedFetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : "Network request failed";
    throw new Error(`Could not reach Tour API (${getApiBaseUrl()}): ${detail}`);
  }
  const body = await res.json().catch(() => null) as { session?: SessionSummary; error?: string } | null;
  if (!res.ok || !body?.session) {
    throw new Error(body?.error ?? "Failed to create session.");
  }
  return { session: body.session };
}

export type CheckInLeadPayload = {
  firstName: string;
  lastName?: string | null;
  email: string;
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

export async function submitCheckInLead(payload: CheckInLeadPayload) {
  const res = await authenticatedFetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as {
    sessionId?: string;
    grouped?: boolean;
    startRecording?: boolean;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(body?.error ?? "Check-in failed.");
  }
  return body ?? { sessionId: undefined, grouped: false, startRecording: false };
}

export async function createCheckInLink(payload: {
  sessionId?: string;
  path?: string;
} = {}) {
  const res = await authenticatedFetch("/api/check-in-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as {
    sessionId?: string;
    url?: string;
    error?: string;
  } | null;
  if (!res.ok || !body?.sessionId || !body.url) {
    throw new Error(body?.error ?? "Could not create a session check-in link.");
  }
  return {
    sessionId: body.sessionId,
    url: body.url,
  };
}

export type ProfileUpdatePayload = {
  name?: string;
  title?: string | null;
  phone?: string | null;
  cardAccent?: string | null;
  aiTrainingDataFeedback?: boolean;
};

export type ProfileResponse = {
  name: string;
  email: string;
  role: string;
  company: string;
  community: string;
  title: string | null;
  phone: string | null;
  cardAccent: string | null;
  aiTrainingDataFeedback: boolean;
};

export async function fetchProfile() {
  const res = await authenticatedFetch("/api/admin/settings/profile");
  const body = await res.json().catch(() => null) as { profile?: ProfileResponse; error?: string } | null;
  if (!res.ok || !body?.profile) throw new Error(body?.error ?? "Failed to load profile.");
  return body.profile;
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  const res = await authenticatedFetch("/api/admin/settings/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as { profile?: ProfileResponse; error?: string } | null;
  if (!res.ok || !body?.profile) throw new Error(body?.error ?? "Failed to update profile.");
  return body.profile;
}

export async function submitSupportRequest(payload: {
  name: string;
  email: string;
  message: string;
  category?: string;
}) {
  const res = await fetch(`${getApiBaseUrl()}/api/support`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, category: payload.category ?? "Mobile app feedback" }),
  });
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Could not send support request.");
}

export async function addSessionParticipant(sessionId: string, payload: Omit<CheckInLeadPayload, "propertyName" | "propertyId" | "repName" | "repSlug">) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as { lead?: SessionLead; error?: string } | null;
  if (!res.ok || !body?.lead) throw new Error(body?.error ?? "Could not add this person.");
  return body.lead;
}

export async function updateSessionParticipantNotes(sessionId: string, createdAt: string, notes: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/participants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ createdAt, notes }),
  });
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Could not save person notes.");
}

export async function addSessionAttachment(sessionId: string, attachment: Omit<SessionAttachment, "createdAt" | "addedBy">) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attachment),
  });
  const body = await res.json().catch(() => null) as { attachment?: SessionAttachment; error?: string } | null;
  if (!res.ok || !body?.attachment) throw new Error(body?.error ?? "Could not attach this asset.");
  return body.attachment;
}

export async function updateSessionNotes(sessionId: string, notes: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Could not save session notes.");
}

export async function fetchSession(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch session detail.");
  }
  return (await res.json()) as {
    session: SessionDetail;
    analysis?: AnalysisResult | null;
    phases?: ConversationPhaseSegmentation | null;
  };
}

export async function getRecordingSignedPlaybackUrl(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/recording/url`);
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to resolve recording playback URL.");
  }
  return (await res.json()) as { signedUrl: string; expiresAt: string };
}

export async function fetchAnalysisRuns(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/analysis/runs`);
  const body = await res.json().catch(() => null) as { runs?: AnalysisRunSummary[]; error?: string } | null;
  if (!res.ok || !body?.runs) {
    throw new Error(body?.error ?? "Failed to load report versions.");
  }
  return { runs: body.runs };
}

export async function downloadSessionReportPdf(sessionId: string, sessionTitle: string, version?: number | null) {
  const query = version == null ? "" : `?version=${encodeURIComponent(String(version))}`;
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/export${query}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "PDF export failed.");
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const filename = responseFilename(res) || `${safeFilename(sessionTitle) || "session"}-evaluation.pdf`;
  const file = new File(Paths.document, `${Date.now()}-${filename}`);
  file.write(bytes);
  return { uri: file.uri, filename };
}

export async function deleteSession(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to delete session.");
  }
  return (await res.json().catch(() => ({ ok: true }))) as { ok?: boolean };
}

function responseFilename(response: Response) {
  const disposition = response.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();
}

export async function fetchRubrics() {
  const res = await authenticatedFetch("/api/admin/rubrics");
  if (!res.ok) {
    throw new Error("Failed to fetch rubrics.");
  }
  return (await res.json()) as { rubrics: Rubric[]; templates: Rubric[] };
}

export async function uploadRubric(
  fileUri: string,
  mimeType: string,
  fileName: string,
  name?: string
) {
  const body = await uploadLocalFileWithPresign<{ rubric?: Rubric }>({
    authenticatedFetch,
    presignPath: "/api/rubrics/upload/presign",
    completePath: "/api/rubrics/upload/complete",
    fileUri,
    mimeType,
    fileName,
    completeBody: () => ({
      ...(name?.trim() ? { name: name.trim() } : {}),
    }),
  });
  if (!body?.rubric) {
    throw new Error("Rubric upload failed.");
  }
  return body.rubric;
}

export async function applyRubricToSession(sessionId: string, rubricId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rubricId }),
  });
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Could not apply rubric.");
  return { ok: true as const };
}

export async function generateAnalysis(
  sessionId: string,
  options?: { rubricId?: string; resegment?: boolean },
) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rubricId: options?.rubricId,
      resegment: options?.resegment,
    }),
  });
  const body = await res.json().catch(() => null) as {
    error?: string;
    analysis?: AnalysisResult;
    async?: boolean;
    runId?: string;
    rubricId?: string;
  } | null;
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to generate analysis.");
  }
  return body ?? { ok: true };
}

export async function fetchAnalysis(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/analysis`);
  if (!res.ok) {
    throw new Error("Failed to fetch analysis.");
  }
  return (await res.json()) as { analysis: AnalysisResult | null };
}

export async function fetchActions(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/actions`);
  if (!res.ok) {
    throw new Error("Failed to fetch actions.");
  }
  return (await res.json()) as { actions: FollowUpAction[] };
}

export async function updateActionStatus(
  sessionId: string,
  actionId: string,
  status: "open" | "completed" | "dismissed"
) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/actions`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionId,
      status
    })
  });

  if (!res.ok) {
    throw new Error("Failed to update action status.");
  }

  return (await res.json()) as { ok: true };
}

export async function fetchTranscript(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/transcript`);
  if (!res.ok) {
    throw new Error("Failed to fetch transcript.");
  }
  return (await res.json()) as {
    transcript: Array<{
      id: string;
      sessionId: string;
      speaker: string;
      startTime: number;
      endTime: number;
      text: string;
    }>;
  };
}

export async function uploadRecording(
  sessionId: string,
  fileUri: string,
  mimeType: string,
  fileName: string,
  durationSec?: number,
  onProgress?: (progress: UploadProgressInfo) => void,
) {
  return uploadLocalFileWithPresign<{ url: string; status: string }>({
    authenticatedFetch,
    presignPath: `/api/sessions/${sessionId}/upload/presign`,
    completePath: `/api/sessions/${sessionId}/upload/complete`,
    fileUri,
    mimeType,
    fileName,
    completeBody: () => ({
      ...(durationSec && durationSec > 0 ? { durationSec: Math.round(durationSec) } : {}),
    }),
    onProgress,
  });
}

export async function processSession(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/process`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Processing failed.");
  }

  const started = (await res.json()) as { ok: boolean; async?: boolean; overallScore?: number };
  if (res.status === 202 || started.async) {
    return waitForSessionProcessing(sessionId);
  }
  return started;
}

async function waitForSessionProcessing(sessionId: string, timeoutMs = 15 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { session } = await fetchSession(sessionId);
    if (session.status === "analysis_ready" || session.status === "reviewed") {
      return { ok: true, overallScore: session.overallScore ?? undefined };
    }
    if (session.status === "failed") {
      throw new Error("Session processing failed.");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Processing timed out. Check back on the session page.");
}

export type Material = {
  id: string;
  name: string;
  type: "rubric" | "training" | "recording" | "other";
  description: string;
  fileUrl?: string | null;
  parsedText?: string | null;
  sessionId?: string | null;
  propertyId?: string | null;
  createdAt: string;
  media?: {
    sourceKey: string;
    videoUrl: string | null;
    imageUrl: string | null;
    gifUrl: string | null;
    iframeUrl: string | null;
  };
};

export type TourLibraryLink = {
  available: true;
  source: "property" | "gmb_fallback";
  communityId: number | null;
  magnetUuid: string | null;
  alias: string | null;
  url: string;
};

export function materialUrl(material: Material) {
  const value = material.media?.videoUrl
    ?? material.media?.iframeUrl
    ?? material.media?.imageUrl
    ?? material.media?.gifUrl
    ?? material.fileUrl
    ?? null;
  if (!value) return null;
  return value.startsWith("/") ? `${getApiBaseUrl()}${value}` : value;
}

export function assetNoteSnippet(asset: Material) {
  const url = materialUrl(asset);
  return [
    `Follow-up asset: ${asset.name}`,
    asset.description || null,
    url ? `Link: ${url}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export type CalendarEvent = {
  id: string;
  session_id: string | null;
  external_event_id: string;
  external_application_id: string | null;
  event_type: "in_person" | "virtual" | "other";
  status: string;
  appointment_date: string;
  time_from: string | null;
  time_to: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  notes: string | null;
  synced_at: string;
};

export type SessionComment = {
  id: string;
  sessionId: string;
  authorName: string;
  body: string;
  kind: "comment" | "key_moment";
  timestampSec: number | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function fetchComments(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/comments`);
  if (!res.ok) throw new Error("Failed to fetch comments.");
  return (await res.json()) as { comments: SessionComment[] };
}

export async function postComment(sessionId: string, payload: {
  body: string;
  authorName?: string;
  kind?: "comment" | "key_moment";
  timestampSec?: number | null;
  parentId?: string | null;
}) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to post comment.");
  return (await res.json()) as { comment: SessionComment };
}

export async function deleteComment(sessionId: string, commentId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/comments`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commentId }),
  });
  if (!res.ok) throw new Error("Failed to delete comment.");
  return (await res.json()) as { ok: boolean };
}

export async function fetchAudioInsights(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/audio-insights`);
  if (!res.ok) {
    throw new Error("Failed to fetch audio insights.");
  }
  return (await res.json()) as {
    status: AudioInsightsStatus;
    insights: AudioInsights | null;
    error?: string | null;
  };
}

export async function startAudioInsights(sessionId: string) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/audio-insights`, {
    method: "POST",
  });
  const body = (await res.json().catch(() => null)) as {
    status?: AudioInsightsStatus;
    error?: string | null;
  } | null;
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to start audio insights.");
  }
  return body ?? { status: "processing" as const };
}

export type LiveSessionChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function createLiveTranscriptionSocket(sessionId: string) {
  const response = await authenticatedFetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/live-transcription`,
    { method: "POST", cache: "no-store" }
  );
  const body = await response.json().catch(() => null) as {
    url?: string;
    expiresAt?: number;
    error?: string;
  } | null;
  if (!response.ok || !body?.url) {
    throw new Error(body?.error ?? "Live transcription is unavailable.");
  }
  return { url: body.url, expiresAt: body.expiresAt ?? 0 };
}

function liveChatAuthHeaders(responseMode: "stream" | "json" = "stream"): Record<string, string> {
  const session = getCurrentSession();
  if (!session) throw new Error("Sign in is required.");
  return {
    Authorization: `Bearer ${session.accessToken}`,
    "x-admin-community-id": session.workspace.community.id,
    "x-tour-client": "mobile",
    "x-tour-response": responseMode,
    "Content-Type": "application/json",
    Accept: responseMode === "json" ? "application/json" : "application/octet-stream, text/plain, */*",
  };
}

function decodeStreamChunk(value: unknown, decoder: TextDecoder): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return decoder.decode(value, { stream: true });
  if (value instanceof ArrayBuffer) return decoder.decode(new Uint8Array(value), { stream: true });
  if (ArrayBuffer.isView(value)) {
    return decoder.decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), { stream: true });
  }
  return "";
}

function liveChatResponseError(response: Response, rawBody: string): string {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const trimmed = rawBody.trim();

  if (contentType.includes("application/json") || trimmed.startsWith("{")) {
    try {
      const body = JSON.parse(trimmed) as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) {
        return body.error.trim();
      }
    } catch {
      // Fall through to the safe status-based message.
    }
  }

  // A missing/misrouted Next.js API endpoint returns an HTML 404 document.
  // Never surface that document as chat copy on the phone.
  if (response.status === 404) {
    return "Tour AI is temporarily unavailable. Please try again shortly.";
  }
  if (response.status === 401 || response.status === 403) {
    return "Your session expired. Sign in again to use Tour AI.";
  }
  if (response.status >= 500) {
    return "Tour AI could not answer right now. Please try again.";
  }

  const looksLikeMarkup = contentType.includes("text/html") || /^\s*</.test(trimmed);
  return looksLikeMarkup || !trimmed
    ? `Tour AI request failed (${response.status}). Please try again.`
    : trimmed.slice(0, 240);
}

/** Streams Tour AI live-chat tokens via expo/fetch (ReadableStream-capable). */
export async function streamLiveSessionChat(
  sessionId: string,
  payload: {
    messages: LiveSessionChatMessage[];
    liveTranscript?: string;
    propertyContext?: string;
  },
  onChunk: (text: string) => void,
): Promise<string> {
  try {
    return await streamLiveSessionChatResponse(sessionId, payload, onChunk);
  } catch (error) {
    const reply = await fetchLiveSessionChatJson(sessionId, payload);
    if (reply) onChunk(reply);
    if (reply) return reply;
    throw error instanceof Error ? error : new Error("Tour AI could not answer right now.");
  }
}

async function streamLiveSessionChatResponse(
  sessionId: string,
  payload: {
    messages: LiveSessionChatMessage[];
    liveTranscript?: string;
    propertyContext?: string;
  },
  onChunk: (text: string) => void,
): Promise<string> {
  const response = await expoFetch(`${getApiBaseUrl()}/api/sessions/${sessionId}/live-chat`, {
    method: "POST",
    headers: liveChatAuthHeaders("stream"),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(liveChatResponseError(response, raw));
  }

  const body = response.body;
  const reader = body && typeof (body as { getReader?: unknown }).getReader === "function"
    ? (body as ReadableStream<Uint8Array>).getReader()
    : null;

  if (!reader) {
    const text = await response.text();
    const reply = text.trim();
    if (reply) onChunk(reply);
    return reply;
  }

  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decodeStreamChunk(value, decoder);
    if (!chunk) continue;
    full += chunk;
    onChunk(full);
  }
  const trailing = decoder.decode();
  if (trailing) {
    full += trailing;
    onChunk(full);
  }
  return full.trim();
}

async function fetchLiveSessionChatJson(
  sessionId: string,
  payload: {
    messages: LiveSessionChatMessage[];
    liveTranscript?: string;
    propertyContext?: string;
  }
): Promise<string> {
  const response = await authenticatedFetch(`/api/sessions/${sessionId}/live-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tour-response": "json",
    },
    body: JSON.stringify({ ...payload, responseMode: "json" }),
  });
  const raw = await response.text().catch(() => "");
  const trimmed = raw.trim();
  let body: { reply?: string; error?: string } | null = null;
  if (trimmed.startsWith("{")) {
    try {
      body = JSON.parse(trimmed) as { reply?: string; error?: string };
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    throw new Error(body?.error ?? liveChatResponseError(response, raw));
  }
  return typeof body?.reply === "string" ? body.reply.trim() : trimmed;
}

export async function sendLiveSessionChat(
  sessionId: string,
  payload: {
    messages: LiveSessionChatMessage[];
    liveTranscript?: string;
    propertyContext?: string;
  }
) {
  const reply = await streamLiveSessionChat(sessionId, payload, () => {});
  return { reply };
}

export async function fetchLiveSessionSuggestions(
  sessionId: string,
  payload: {
    liveTranscript?: string;
    propertyContext?: string;
  } = {}
) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/live-suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as { suggestions?: string[]; error?: string } | null;
  if (!res.ok) {
    throw new Error(body?.error ?? "Could not load live suggestions.");
  }
  const suggestions = Array.isArray(body?.suggestions)
    ? body.suggestions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return { suggestions };
}

export async function sendSessionFollowUp(
  sessionId: string,
  payload: { phone?: string; includeCardImage?: boolean }
) {
  const res = await authenticatedFetch(`/api/sessions/${sessionId}/send-follow-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null) as {
    ok?: boolean;
    skipped?: boolean;
    followUpUrl?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to send follow-up.");
  }
  return body ?? { ok: true };
}

export async function fetchMaterials() {
  const res = await authenticatedFetch("/api/materials");
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to fetch property assets.");
  }
  return (await res.json()) as {
    materials: Material[];
    tourLibrary: TourLibraryLink | null;
    propertyWebsite: string | null;
  };
}

export async function uploadMaterial(
  fileUri: string,
  mimeType: string,
  fileName: string,
  metadata?: {
    name?: string;
    description?: string;
    type?: Material["type"];
  },
) {
  const body = await uploadLocalFileWithPresign<{ material?: Material }>({
    authenticatedFetch,
    presignPath: "/api/materials/upload/presign",
    completePath: "/api/materials/upload/complete",
    fileUri,
    mimeType,
    fileName,
    completeBody: () => ({
      name: metadata?.name?.trim() || fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      description: metadata?.description?.trim() || "",
      type: metadata?.type ?? "other",
    }),
  });
  if (!body?.material) throw new Error("Asset upload failed.");
  return body.material;
}

export type PanoramaUploadShot = {
  uri: string;
  fileName: string;
  mimeType: "image/jpeg";
  index: number;
  headingDegrees: number;
  targetHeadingDegrees: number;
  rollDegrees: number;
  pitchDegrees: number;
};

export type PanoramaUploadAsset = {
  name: string;
  description: string;
  shots: PanoramaUploadShot[];
};

export async function uploadPanoramaMaterial(asset: PanoramaUploadAsset) {
  const orderedShots = [...asset.shots].sort((left, right) => left.index - right.index);
  if (
    (orderedShots.length !== 6 && orderedShots.length !== 8)
    || orderedShots.some((shot, index) => shot.index !== index)
  ) {
    throw new Error("A 360° panorama requires six or eight ordered photos.");
  }

  const uploadedShots: Array<{
    objectKey: string;
    index: number;
    headingDegrees: number;
    targetHeadingDegrees: number;
    rollDegrees: number;
    pitchDegrees: number;
  }> = [];

  for (const shot of orderedShots) {
    const uploaded = await uploadLocalFileWithPresign<{ objectKey?: string }>({
      authenticatedFetch,
      presignPath: "/api/materials/upload/presign",
      completePath: "/api/materials/panorama/shot",
      fileUri: shot.uri,
      mimeType: shot.mimeType,
      fileName: shot.fileName,
      completeBody: () => ({ shotIndex: shot.index }),
    });
    if (!uploaded.objectKey) {
      throw new Error(`Panorama photo ${shot.index + 1} did not finish uploading.`);
    }
    uploadedShots.push({
      objectKey: uploaded.objectKey,
      index: shot.index,
      headingDegrees: shot.headingDegrees,
      targetHeadingDegrees: shot.targetHeadingDegrees,
      rollDegrees: shot.rollDegrees,
      pitchDegrees: shot.pitchDegrees,
    });
  }

  const response = await authenticatedFetch("/api/materials/panorama/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: asset.name,
      description: asset.description,
      shots: uploadedShots,
    }),
  });
  const body = await response.json().catch(() => null) as { material?: Material; error?: string } | null;
  if (!response.ok || !body?.material) {
    throw new Error(body?.error ?? "The panorama could not be stitched.");
  }
  return body.material;
}

export async function fetchCalendarEvents(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const query = params.toString();
  const res = await authenticatedFetch(`/api/admin/calendar/scheduled${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch Entrata calendar.");
  return (await res.json()) as {
    community: { id: string; name: string };
    events: CalendarEvent[];
  };
}

export async function syncCalendar() {
  const res = await authenticatedFetch("/api/admin/calendar/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json().catch(() => null) as {
    sync?: { eventsSynced: number; prospectsEnriched?: number };
    error?: string;
  } | null;
  if (!res.ok) throw new Error(body?.error ?? "Entrata sync failed.");
  return body?.sync;
}
