import assert from "node:assert/strict";
import test from "node:test";
import type { SessionSummary } from "@tour/shared";

import { selectUpcomingTours } from "../src/dashboard.ts";

const now = Date.parse("2026-09-05T12:00:00Z");

function session(id: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id,
    title: `Tour ${id}`,
    prospectName: null,
    agentName: null,
    scheduledAt: "2026-09-06T12:00:00Z",
    location: null,
    status: "scheduled",
    source: "manual",
    sessionKind: "tour",
    leads: [],
    attachments: [],
    rubricId: null,
    overallScore: null,
    duration: null,
    createdAt: "2026-09-05T10:00:00Z",
    audioInsightsStatus: "pending",
    ...overrides,
  };
}

function guest(name: string, createdAt = "2026-09-05T11:00:00Z") {
  return { name, email: null, phone: null, wantsSummary: false, createdAt };
}

test("fresh completed sessions override stale upcoming copies", () => {
  const stale = session("done", { status: "in_progress", leads: [guest("Alex")] });
  const fresh = session("done", { status: "reviewed" });
  assert.deepEqual(selectUpcomingTours([fresh], [stale], { now }), []);
});

test("multiple guests and overlapping queries produce only one tour card", () => {
  const stale = session("family", { status: "in_progress", leads: [guest("Alex")] });
  const fresh = { ...stale, leads: [guest("Alex"), guest("Sam")] };
  const result = selectUpcomingTours([fresh], [stale, stale], { now });
  assert.equal(result.length, 1);
  assert.equal(result[0], fresh);
  assert.equal(result[0]?.leads.length, 2);
});

test("checked-in tours from the regular list are not hidden behind scheduled tours", () => {
  const checkedIn = session("ready", {
    status: "in_progress",
    scheduledAt: "2026-09-04T10:00:00Z",
    leads: [guest("Alex")],
  });
  const schedules = [
    session("later", { scheduledAt: "2026-09-07T09:00:00Z" }),
    session("soon", { scheduledAt: "2026-09-05T13:00:00Z" }),
  ];
  assert.deepEqual(
    selectUpcomingTours([checkedIn], schedules, { now }).map((tour) => tour.id),
    ["ready", "soon"],
  );
});

test("the latest check-in leads the ready tours and input arrays remain unchanged", () => {
  const recentlyJoined = session("recent-guest", {
    status: "in_progress",
    createdAt: "2026-09-04T10:00:00Z",
    leads: [guest("Alex", "2026-09-05T11:59:00Z")],
  });
  const olderCheckIn = session("older-guest", { status: "in_progress", leads: [guest("Sam")] });
  const noGuests = session("recording", { status: "in_progress", createdAt: "2026-09-05T12:00:00Z" });
  const input = [olderCheckIn, noGuests, recentlyJoined];
  assert.deepEqual(
    selectUpcomingTours(input, [], { now, limit: 3 }).map((tour) => tour.id),
    ["recent-guest", "older-guest", "recording"],
  );
  assert.deepEqual(input.map((tour) => tour.id), ["older-guest", "recording", "recent-guest"]);
});

test("a deferred preferred pending tour stays first", () => {
  const ready = session("ready", { status: "in_progress", leads: [guest("Alex")] });
  const preferred = session("deferred", { status: "in_progress", createdAt: "2026-09-01T10:00:00Z" });
  assert.deepEqual(
    selectUpcomingTours([ready, preferred], [], { now, preferredSessionId: "deferred" }).map((tour) => tour.id),
    ["deferred", "ready"],
  );
});

test("preferred does not resurrect completed or past scheduled tours", () => {
  for (const excluded of [
    session("preferred", { status: "analysis_ready" }),
    session("preferred", { scheduledAt: "2026-09-05T11:59:59Z" }),
  ]) {
    assert.deepEqual(selectUpcomingTours([excluded], [], { now, preferredSessionId: "preferred" }), []);
  }
});

test("only active tours and scheduled tours with valid upcoming dates are included", () => {
  const candidates = [
    session("past", { scheduledAt: "2026-09-05T11:59:59Z" }),
    session("missing-date", { scheduledAt: null }),
    session("invalid-date", { scheduledAt: "not-a-date" }),
    session("processing", { status: "uploaded" }),
    session("now", { scheduledAt: "2026-09-05T12:00:00Z" }),
    session("active-no-date", { status: "in_progress", scheduledAt: null }),
    session("future"),
  ];
  assert.deepEqual(
    selectUpcomingTours(candidates, [], { now, limit: 10 }).map((tour) => tour.id),
    ["active-no-date", "now", "future"],
  );
});

test("empty lists and zero limit return no cards", () => {
  assert.deepEqual(selectUpcomingTours([], [], { now }), []);
  assert.deepEqual(selectUpcomingTours([session("future")], [], { now, limit: 0 }), []);
});
