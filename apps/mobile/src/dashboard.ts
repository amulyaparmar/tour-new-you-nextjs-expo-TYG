import type { SessionSummary } from "@tour/shared";

/** Keep checked-in tours visible without showing one card per guest or stale completed tours. */
export function selectUpcomingTours(
  sessions: SessionSummary[],
  upcomingSessions: SessionSummary[],
  options: { preferredSessionId?: string | null; limit?: number; now?: number } = {},
): SessionSummary[] {
  const now = options.now ?? Date.now();
  // The regular list is fresher after recording; let its completed rows remove
  // older pending copies from the upcoming query before applying the filter.
  const byId = new Map(upcomingSessions.map((session) => [session.id, session]));
  for (const session of sessions) byId.set(session.id, session);

  const readyAt = (session: SessionSummary) => Math.max(
    Date.parse(session.createdAt) || 0,
    ...session.leads.map((lead) => Date.parse(lead.createdAt) || 0),
  );
  const priority = (session: SessionSummary) => {
    if (session.id === options.preferredSessionId) return 0;
    if (session.status === "in_progress") return session.leads.length ? 1 : 2;
    return 3;
  };

  return [...byId.values()]
    .filter((session) => session.status === "in_progress" || (
      session.status === "scheduled"
      && session.scheduledAt !== null
      && Date.parse(session.scheduledAt) >= now
    ))
    .sort((a, b) => {
      const priorityDifference = priority(a) - priority(b);
      if (priorityDifference) return priorityDifference;
      if (a.status === "in_progress" && b.status === "in_progress") {
        return readyAt(b) - readyAt(a) || a.id.localeCompare(b.id);
      }
      return Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!)
        || a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, options.limit ?? 2));
}

export type DashboardMetrics = {
  todaySessions: number;
  upcomingSessions: number;
  processingSessions: number;
  liveSessions: number;
  reviewQueue: number;
  analyzedSessions: number;
  completedSessions: number;
  averageScore: number | null;
};

export function computeDashboardMetrics(sessions: SessionSummary[]): DashboardMetrics {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const inProgressStatuses = ["uploaded", "transcribing", "segmenting", "analyzing"];

  const todaySessions = sessions.filter((session) => {
    if (!session.scheduledAt) {
      return false;
    }
    const ts = new Date(session.scheduledAt).getTime();
    return Math.abs(ts - now) < oneDay;
  }).length;

  const upcomingSessions = sessions.filter((session) => {
    return (
      (session.scheduledAt && new Date(session.scheduledAt).getTime() > now) ||
      inProgressStatuses.includes(session.status)
    );
  }).length;

  const processingSessions = sessions.filter((session) =>
    inProgressStatuses.includes(session.status)
  ).length;
  const liveSessions = sessions.filter((session) => session.status === "in_progress").length;
  const reviewQueue = sessions.filter((session) =>
    ["uploaded", "analysis_ready", "failed"].includes(session.status)
  ).length;
  const analyzedSessions = sessions.filter((session) =>
    ["analysis_ready", "reviewed"].includes(session.status)
  ).length;
  const completedSessions = sessions.filter((session) => session.status === "reviewed").length;

  const scored = sessions.filter((session) => typeof session.overallScore === "number");
  const averageScore = scored.length
    ? Math.round(scored.reduce((acc, session) => acc + (session.overallScore ?? 0), 0) / scored.length)
    : null;

  return {
    todaySessions,
    upcomingSessions,
    processingSessions,
    liveSessions,
    reviewQueue,
    analyzedSessions,
    completedSessions,
    averageScore
  };
}
