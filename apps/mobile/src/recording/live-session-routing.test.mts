import assert from "node:assert/strict";
import test from "node:test";

import {
  localSessionIsPendingUpload,
  resolveLiveSessionOpen,
} from "./live-session-routing.ts";

test("live recorder for this session expands instead of opening session detail", () => {
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: "s1",
      hasLiveExperience: true,
      session: { id: "s1", status: "in_progress" },
      hasPendingFinishedRecording: false,
    }),
    "expand",
  );
});

test("live recorder stays in front when another in-progress tour is tapped", () => {
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: "live",
      hasLiveExperience: true,
      session: { id: "other", status: "in_progress" },
      hasPendingFinishedRecording: false,
    }),
    "expand",
  );
});

test("finished or scheduled sessions still open their pages during a live tour", () => {
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: "live",
      hasLiveExperience: true,
      session: { id: "done", status: "analysis_ready" },
      hasPendingFinishedRecording: false,
    }),
    "detail",
  );
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: "live",
      hasLiveExperience: true,
      session: { id: "soon", status: "scheduled" },
      hasPendingFinishedRecording: false,
    }),
    "detail",
  );
});

test("in-progress tours without a live recorder open the recording page", () => {
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: null,
      hasLiveExperience: false,
      session: { id: "s1", status: "in_progress" },
      hasPendingFinishedRecording: false,
    }),
    "open",
  );
});

test("finished recordings waiting to upload open session detail, not a new recorder", () => {
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: null,
      hasLiveExperience: false,
      session: { id: "s1", status: "in_progress" },
      hasPendingFinishedRecording: true,
    }),
    "detail",
  );
  assert.equal(localSessionIsPendingUpload({ status: "ready_to_sync" }), true);
  assert.equal(localSessionIsPendingUpload({ status: "recording" }), false);
});

test("scheduled tours keep the hub unless recording was requested", () => {
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: null,
      hasLiveExperience: false,
      session: { id: "s1", status: "scheduled" },
      hasPendingFinishedRecording: false,
    }),
    "detail",
  );
  assert.equal(
    resolveLiveSessionOpen({
      liveSessionId: null,
      hasLiveExperience: false,
      session: { id: "s1", status: "scheduled" },
      autoStartRecording: true,
      hasPendingFinishedRecording: false,
    }),
    "open",
  );
});

test("analyzed and processing sessions always open session detail", () => {
  for (const status of ["uploaded", "transcribing", "analyzing", "analysis_ready", "reviewed"]) {
    assert.equal(
      resolveLiveSessionOpen({
        liveSessionId: null,
        hasLiveExperience: false,
        session: { id: "s1", status },
        hasPendingFinishedRecording: false,
      }),
      "detail",
      status,
    );
  }
});
