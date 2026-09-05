import type { SessionSummary } from "@tour/shared";
import type { StatusFilter } from "./types/ui";

export const FAILED_SESSION_COLORS = { bg: "#F2F4F7", text: "#475467" } as const;

export function needsSessionReview(status: SessionSummary["status"]): boolean {
  return status === "uploaded" || status === "analysis_ready";
}

export function sessionListBadge(status: SessionSummary["status"]) {
  if (status === "failed") return { label: "FAILED", tone: "failed" } as const;
  if (needsSessionReview(status)) return { label: "REVIEW", tone: "review" } as const;
  if (status === "in_progress") return { label: "LIVE", tone: "live" } as const;
  return { label: "SYNCED", tone: "synced" } as const;
}

export function matchesSessionStatusFilter(session: SessionSummary, filter: StatusFilter): boolean {
  if (filter === "failed") return session.status === "failed";
  if (filter === "needs_review") return needsSessionReview(session.status);
  if (filter === "feedback") {
    return session.status !== "failed" && (
      session.status === "analysis_ready" || session.status === "reviewed" || session.overallScore !== null
    );
  }
  return true;
}
