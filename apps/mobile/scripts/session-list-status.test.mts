import assert from "node:assert/strict";
import test from "node:test";
import type { SessionSummary } from "@tour/shared";

import { computeDashboardMetrics } from "../src/dashboard.ts";
import { FAILED_SESSION_COLORS, matchesSessionStatusFilter, needsSessionReview, sessionListBadge } from "../src/session-list-status.ts";

function session(status: SessionSummary["status"], overallScore: number | null = null): SessionSummary {
  return {
    id: status, title: status, status, overallScore,
    source: "manual", sessionKind: "tour", prospectName: null, agentName: null,
    scheduledAt: null, location: null, leads: [], attachments: [], rubricId: null,
    duration: null, createdAt: "2026-09-05T12:00:00Z", audioInsightsStatus: "pending",
  };
}

test("failed badge is explicit and uses neutral gray colors", () => {
  assert.deepEqual(sessionListBadge("failed"), { label: "FAILED", tone: "failed" });
  assert.deepEqual(FAILED_SESSION_COLORS, { bg: "#F2F4F7", text: "#475467" });
});

test("failed sessions remain in All and Failed but not review or feedback", () => {
  for (const score of [null, 82]) {
    const failed = session("failed", score);
    assert.equal(matchesSessionStatusFilter(failed, "all"), true);
    assert.equal(matchesSessionStatusFilter(failed, "failed"), true);
    assert.equal(matchesSessionStatusFilter(failed, "needs_review"), false);
    assert.equal(matchesSessionStatusFilter(failed, "feedback"), false);
  }
});

test("only failed status matches the dedicated Failed filter", () => {
  for (const status of ["scheduled", "in_progress", "uploaded", "transcribing", "segmenting", "analyzing", "analysis_ready", "reviewed"] as const) {
    assert.equal(matchesSessionStatusFilter(session(status), "failed"), false, status);
    assert.equal(matchesSessionStatusFilter(session(status), "all"), true, status);
  }
});

test("review labels and counts exclude failed sessions", () => {
  const sessions = [session("uploaded"), session("analysis_ready"), session("failed"), session("reviewed")];
  assert.deepEqual(sessions.filter((item) => needsSessionReview(item.status)).map((item) => item.id), ["uploaded", "analysis_ready"]);
  assert.equal(computeDashboardMetrics(sessions).reviewQueue, 2);
  assert.equal(sessionListBadge("uploaded").label, "REVIEW");
  assert.equal(sessionListBadge("analysis_ready").label, "REVIEW");
  assert.equal(sessionListBadge("in_progress").label, "LIVE");
  assert.equal(sessionListBadge("reviewed").label, "SYNCED");
});

test("completed feedback remains available", () => {
  assert.equal(matchesSessionStatusFilter(session("analysis_ready"), "feedback"), true);
  assert.equal(matchesSessionStatusFilter(session("reviewed"), "feedback"), true);
  assert.equal(matchesSessionStatusFilter(session("analyzing"), "feedback"), false);
});
