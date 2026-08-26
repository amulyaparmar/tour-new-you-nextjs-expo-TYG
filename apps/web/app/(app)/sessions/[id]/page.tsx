import Link from "next/link";

import { buildSessionTourTitle, SESSION_STATUS_LABELS } from "@tour/shared";

import { getTranscriptForSession } from "@/lib/evidence";
import { listVisibleMaterials } from "@/lib/materials";
import { getRubricForSession } from "@/lib/rubrics";
import { isSampleSourceProperty, SAMPLE_SESSION_SET } from "@/lib/sample-sessions";
import { enrichSessionWithAgentName, sessionParticipants } from "@/lib/session-participants";
import { getAnalysisRun, getAudioInsights, getConversationPhases, getSessionById, listAnalysisRuns, listSessionsPaginated } from "@/lib/sessions";
import { getRecordingUrl, isLegacyLocalUrl } from "@/lib/storage";
import { AnalysisVersionSelector } from "./AnalysisVersionSelector";
import { DeleteSessionButton } from "./DeleteSessionButton";
import { EditSessionForm } from "./EditSessionForm";
import { EditSessionParticipants } from "./EditSessionParticipants";
import { ExportSessionButton } from "./ExportSessionButton";
import { SessionDetailExperience } from "./SessionDetailExperience";
import { SessionScoreSummary } from "./SessionScoreSummary";
import styles from "./session-detail.module.css";
import { UploadAndProcess, type NoteAsset, type SessionDetailDefaults } from "./UploadAndProcess";
import { getTourWorkspace } from "@/lib/tour-auth";
import FollowUpPage from "@/app/follow-up/[id]/page";
import { findPropertyForSessionKey, isGlobalPropertyAdminEmail, propertySessionKeys } from "@/lib/admin-auth";
import { SessionPropertyMismatch } from "./SessionPropertyMismatch";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string; sample?: string }>;
};

export default async function SessionDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const workspace = await getTourWorkspace();
  if (!workspace) return <FollowUpPage params={Promise.resolve({ id })} />;
  const { version: versionParam, sample: sampleParam } = await searchParams;
  const rawSession = await getSessionById(id);
  const isOwnSession = Boolean(rawSession && propertySessionKeys(workspace.community).includes(rawSession.propertyId ?? ""));
  const isSampleCandidate = Boolean(
    sampleParam === "1" &&
    rawSession &&
    SAMPLE_SESSION_SET.has(id) &&
    isSampleSourceProperty(rawSession.propertyId)
  );
  const isSampleSession = isSampleCandidate
    ? await activePropertyHasNoRecordedSessions(workspace.community)
    : false;

  if (!rawSession) {
    return (
      <>
        <Link href="/sessions" className="back-link">&larr; Sessions</Link>
        <h1 style={{ fontSize: 20 }}>Session not found</h1>
      </>
    );
  }

  const isPropertyMismatch = !isOwnSession && !isSampleSession;
  const accessibleProperty = isPropertyMismatch
    ? workspace.communities.find((community) =>
        propertySessionKeys(community).includes(rawSession.propertyId ?? "")
      ) ?? null
    : null;
  const resolvedProperty = isPropertyMismatch
    ? accessibleProperty
      ? { id: accessibleProperty.propertyTygId, name: accessibleProperty.name }
      : await findPropertyForSessionKey(rawSession.propertyId)
    : null;
  const isGlobalAdmin = isGlobalPropertyAdminEmail(workspace.user.email);
  const canModifySession = isOwnSession || isGlobalAdmin;
  const isReadOnlyExternal = isPropertyMismatch && !canModifySession;

  const session = isSampleSession || isPropertyMismatch
    ? rawSession
    : await enrichSessionWithAgentName(rawSession, workspace);
  const sessionTitle = buildSessionTourTitle({
    title: session.title,
    agentName: session.agentName,
    prospectName: session.prospectName || session.leads?.[0]?.name,
  });
  const participants = sessionParticipants(session.agentName, session.prospectName);

  const analysisRun = await getAnalysisRun(id, versionParam ?? null);
  const analysis = analysisRun?.result ?? null;
  const analysisRuns = analysis ? await listAnalysisRuns(id) : [];
  const viewingHistoricalVersion = Boolean(
    analysisRun && !analysisRun.isCurrent && analysisRuns.length > 1
  );

  const isScheduled = session.status === "scheduled" || session.status === "in_progress";
  const hasRecording = !isScheduled;
  const hasAnalysis = !!analysis;
  const isProcessing = ["uploaded", "transcribing", "segmenting", "analyzing"].includes(session.status);
  const defaults = !hasAnalysis ? getSessionDetailDefaults(session) : null;
  const noteAssetsPromise = !hasAnalysis ? getNoteAssets(session.propertyId) : Promise.resolve<NoteAsset[]>([]);
  const detailDataPromise: Promise<[
    Awaited<ReturnType<typeof getTranscriptForSession>>,
    string | null,
    Awaited<ReturnType<typeof getRubricForSession>> | null,
    Awaited<ReturnType<typeof getConversationPhases>>,
    Awaited<ReturnType<typeof getAudioInsights>>,
  ]> = hasAnalysis
    ? Promise.all([
      getTranscriptForSession(id),
      resolveRecordingUrl(id, session.videoUrl, session.audioUrl),
      getRubricForSession(analysisRun?.rubricId ?? session.rubricId, session.propertyId),
      getConversationPhases(id),
      getAudioInsights(id),
    ])
    : isReadOnlyExternal
      ? Promise.all([
          Promise.resolve([]),
          resolveRecordingUrl(id, session.videoUrl, session.audioUrl),
          Promise.resolve(null),
          Promise.resolve(null),
          Promise.resolve(null),
        ])
      : Promise.resolve([[], null, null, null, null]);

  const [noteAssets, [transcript, recordingUrl, rubric, phases, audioInsights]] = await Promise.all([
    noteAssetsPromise,
    detailDataPromise,
  ]);

  return (
    <div className={hasAnalysis ? `${styles.page} ${styles.pageExperience}` : styles.page}>
      <Link href="/sessions" className="back-link">&larr; Back to Sessions</Link>

      {isPropertyMismatch && (
        <SessionPropertyMismatch
          currentPropertyName={workspace.community.name}
          targetPropertyId={resolvedProperty?.id ?? null}
          targetPropertyName={resolvedProperty?.name ?? "another property"}
          canSwitch={Boolean(accessibleProperty) || isGlobalAdmin}
          sessionId={id}
        />
      )}

      {isSampleSession && (
        <p className={styles.analysisVersionBanner}>
          Viewing a read-only sample because this property does not have recorded tours yet.
        </p>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{sessionTitle}</h1>
          <p className={styles.meta}>
            {session.scheduledAt
              ? new Date(session.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
              : "Unscheduled"}
            {session.agentName ? ` · ${session.agentName} · Agent` : ""}
            {session.prospectName ? ` · ${session.prospectName} · Prospect` : ""}
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </div>
        <div className={styles.headerRight}>
          {!isSampleSession && !isReadOnlyExternal && (
            <EditSessionParticipants
              sessionId={id}
              title={session.title}
              agentName={session.agentName}
              prospectName={session.prospectName}
            />
          )}
          {hasAnalysis && analysisRuns.length > 0 && (
            <AnalysisVersionSelector
              sessionId={id}
              runs={analysisRuns}
              selectedVersion={analysisRun?.version ?? null}
            />
          )}
          <span className={`badge badge-${session.status}`}>{SESSION_STATUS_LABELS[session.status]}</span>
          <a
            href={`/follow-up/${encodeURIComponent(id)}`}
            className="btn btn-outline btn-sm"
            target="_blank"
            rel="noreferrer"
          >
            Public follow-up
          </a>
          {hasAnalysis && !isSampleSession && (
            <ExportSessionButton
              href={`/api/sessions/${encodeURIComponent(id)}/export${analysisRun && !analysisRun.isCurrent ? `?version=${analysisRun.version}` : ""}`}
              audioHref={`/api/sessions/${encodeURIComponent(id)}/recording?download=1`}
              transcriptHref={transcript.length > 0 ? `/api/sessions/${encodeURIComponent(id)}/transcript?download=1` : null}
              coachingMomentsHref={analysis?.exactMoments.length
                ? `/api/sessions/${encodeURIComponent(id)}/coaching-moments${analysisRun && !analysisRun.isCurrent ? `?version=${analysisRun.version}` : ""}`
                : null}
              sessionTitle={sessionTitle}
            />
          )}
          {!isSampleSession && !isReadOnlyExternal && <DeleteSessionButton sessionId={id} />}
        </div>
      </div>

      {session.leads.length > 0 && !hasAnalysis && (
        <section className="card" style={{ marginBottom: 16 }} aria-labelledby="checked-in-heading">
          <div className="card-header">
            <div>
              <h2 id="checked-in-heading">Checked in</h2>
              <p style={{ margin: "4px 0 0", color: "var(--slate-500)", fontSize: 13 }}>
                {session.leads.length} {session.leads.length === 1 ? "visitor" : "visitors"} ready for this tour
              </p>
            </div>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            {session.leads.map((lead) => (
              <article
                key={`${lead.createdAt}-${lead.email ?? ""}-${lead.phone ?? ""}`}
                style={{ padding: 12, border: "1px solid var(--slate-200)", borderRadius: 12 }}
              >
                <div style={{ fontWeight: 750, color: "var(--slate-900)" }}>{lead.name}</div>
                {lead.jobTitle || lead.reason ? (
                  <div style={{ marginTop: 3, color: "var(--slate-500)", fontSize: 13 }}>
                    {[lead.jobTitle, lead.reason].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
                <div style={{ marginTop: 5, color: "var(--slate-600)", fontSize: 13 }}>
                  {[lead.email, lead.phone].filter(Boolean).join(" · ")}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!hasAnalysis && isScheduled && !isReadOnlyExternal && (
        <UploadAndProcess sessionId={id} sessionCreatedAt={session.createdAt} hasRecording={false} variant="new-session" defaults={defaults ?? undefined} noteAssets={noteAssets} recordingDuration={session.duration} />
      )}

      {!hasAnalysis && !isScheduled && !isReadOnlyExternal && (
        <UploadAndProcess sessionId={id} sessionCreatedAt={session.createdAt} hasRecording={hasRecording} defaults={defaults ?? undefined} noteAssets={noteAssets} recordingDuration={session.duration} />
      )}

      {!hasAnalysis && isReadOnlyExternal && recordingUrl && (
        <section className="card" style={{ marginTop: 16 }} aria-label="Session recording">
          <div className="card-header"><h2>Session recording</h2></div>
          <div className="card-body">
            {/\.(?:mp4|webm|mov)(?:\?|$)/i.test(recordingUrl) || Boolean(session.videoUrl && !session.audioUrl) ? (
              <video controls playsInline preload="metadata" src={recordingUrl} style={{ width: "100%", borderRadius: 14, background: "#0b1220" }} />
            ) : (
              <audio controls preload="metadata" src={recordingUrl} style={{ width: "100%" }} />
            )}
          </div>
        </section>
      )}

      {hasAnalysis && (
        <>
          {viewingHistoricalVersion && analysisRun && (
            <p className={styles.analysisVersionBanner}>
              Viewing analysis v{analysisRun.version}
              {analysisRun.rubricName ? ` (${analysisRun.rubricName})` : ""}
              {" · "}
              <Link href={`/sessions/${encodeURIComponent(id)}`}>View current</Link>
            </p>
          )}
          <SessionScoreSummary analysis={analysis} />
          <SessionDetailExperience
            sessionId={id}
            analysis={analysis}
            transcript={transcript}
            recordingUrl={recordingUrl}
            videoUrl={session.videoUrl}
            audioUrl={session.audioUrl}
            duration={session.duration ?? estimateDuration(analysis.exactMoments)}
            phases={phases}
            initialAudioInsightsStatus={session.audioInsightsStatus}
            initialAudioInsights={audioInsights}
            participants={participants}
            prospectName={session.prospectName}
            leads={session.leads}
            customerInterests={session.customerInterests ?? []}
            rubric={rubric ? { id: rubric.id, name: rubric.name, analysisModel: rubric.analysisModel } : null}
            readOnly={isReadOnlyExternal}
          />
        </>
      )}

      {!hasAnalysis && !isProcessing && hasRecording && !isReadOnlyExternal && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><h2>Session Details</h2></div>
          <div className="card-body">
            <EditSessionForm
              sessionId={id}
              title={sessionTitle}
              scheduledAt={session.scheduledAt}
              agentName={session.agentName}
              prospectName={session.prospectName}
              location={session.location}
              notes={session.notes}
              customerInterests={session.customerInterests ?? []}
            />
          </div>
        </div>
      )}
    </div>
  );
}

async function activePropertyHasNoRecordedSessions(
  community: Parameters<typeof propertySessionKeys>[0]
) {
  const ownSessions = await listSessionsPaginated({
    limit: 1,
    propertyIds: propertySessionKeys(community),
    excludeScheduled: true,
  });
  return ownSessions.total === 0;
}

async function getNoteAssets(propertyId: string | null | undefined): Promise<NoteAsset[]> {
  const materials = await listVisibleMaterials(propertyId ?? undefined);
  return materials
    .map((material): NoteAsset | null => {
      const url = material.media?.videoUrl ?? material.media?.iframeUrl ?? material.fileUrl ?? null;
      if (!url) return null;
      return {
        id: material.id,
        name: material.name,
        description: material.description,
        url
      };
    })
    .filter((asset): asset is NoteAsset => asset !== null)
    .slice(0, 10);
}

function getSessionDetailDefaults(
  session: NonNullable<Awaited<ReturnType<typeof getSessionById>>>
): SessionDetailDefaults {
  const lead = session.leads?.[0];
  const prospectName = session.prospectName || lead?.name || "";
  const agentName = session.agentName || "";
  const location = session.location || lead?.reason?.replace(/^Tour\s+/i, "") || "";
  const title = session.title || [location || "Tour", prospectName].filter(Boolean).join(" - ");

  return {
    title,
    agentName,
    prospectName,
    location
  };
}

function estimateDuration(moments: Array<{ timestamp: string }>): number {
  let maxSec = 0;
  for (const m of moments) {
    const sec = parseTimestampToSeconds(m.timestamp);
    if (sec > maxSec) maxSec = sec;
  }
  return maxSec > 0 ? maxSec + 60 : 0;
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return -1;
}

async function resolveRecordingUrl(
  sessionId: string,
  videoUrl: string | null,
  audioUrl: string | null
): Promise<string | null> {
  const stored = videoUrl || audioUrl;
  const proxied = await getRecordingUrl(sessionId);
  if (proxied) return proxied;

  if (stored && !isLegacyLocalUrl(stored)) {
    if (stored.startsWith("http") || stored.startsWith("/api/sessions/")) return stored;
  }
  return null;
}
