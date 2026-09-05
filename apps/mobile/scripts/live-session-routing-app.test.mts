import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

test("starting a checked-in tour stays on the recorder, not session detail", () => {
  const startTour = appSource.match(
    /function CheckInStartTourScreen\([\s\S]*?\n\}\n\nexport default function App/,
  );
  assert.ok(startTour, "CheckInStartTourScreen should remain a distinct screen");
  assert.match(startTour[0], /openBoundSessionRecording\(/);
  assert.match(startTour[0], /onLiveOpened\(\)/);
  assert.doesNotMatch(startTour[0], /onOpenSession/);
  assert.doesNotMatch(startTour[0], /session-detail/);
});

test("the live dock stays available on main tabs during a bound tour", () => {
  assert.match(
    appSource,
    /onLiveOpened=\{\(\) =>\s*nav\(\{\s*type: "main"/,
  );
  assert.match(appSource, /function MainTabs\(/);
  assert.match(appSource, /<LiveRecordingDock \/>/);
  const mainTabs = appSource.match(/function MainTabs\([\s\S]*?\nfunction ErrorBanner/);
  assert.ok(mainTabs);
  assert.ok(mainTabs[0].indexOf("<LiveRecordingDock") < mainTabs[0].indexOf("st.tabBar"));
});

test("list taps and session detail hand off in-progress tours to the recorder", () => {
  assert.match(appSource, /const openListedSession = useCallback\(/);
  assert.match(appSource, /resolveLiveSessionOpen\(/);
  assert.match(appSource, /openBoundSessionRecording\(rec,/);
  assert.match(appSource, /onSession=\{openListedSession\}/);
  const detail = appSource.match(
    /function SessionDetailScreen\([\s\S]*?function UploadProcessCard/,
  );
  assert.ok(detail, "SessionDetailScreen should hand off live tours before the hub");
  assert.match(detail[0], /resolveLiveSessionOpen\(/);
  assert.match(detail[0], /openBoundSessionRecording\(/);
  assert.match(detail[0], /onBackRef\.current\(\)/);
});

test("finishing a bound tour opens session detail after upload", () => {
  const helper = appSource.match(
    /function openBoundSessionRecording\([\s\S]*?\nfunction CheckInStartTourScreen/,
  );
  assert.ok(helper, "openBoundSessionRecording should own finish/cancel");
  assert.match(helper[0], /openFinishedBoundSession\?\.\(sessionId\)/);
  assert.match(helper[0], /status: "in_progress"/);
  assert.match(helper[0], /status: "scheduled"/);
});

test("starting a new tour opens the recorder instead of a preparing page", () => {
  const createSession = appSource.match(
    /function CreateSessionScreen\([\s\S]*?\nfunction AgentIdentityToggle/,
  );
  assert.ok(createSession, "CreateSessionScreen should remain a distinct screen");
  assert.doesNotMatch(createSession[0], /Preparing recorder/);
  assert.match(createSession[0], /preparing: !createOptionsReadyRef\.current/);
  assert.match(createSession[0], /rec\.patchDraft\(/);
  assert.match(createSession[0], /useLayoutEffect\(/);
});

test("the live recorder is not resized by the app keyboard avoiding view", () => {
  assert.match(appSource, /function RecordingAwareKeyboardAvoiding/);
  assert.match(appSource, /enabled=\{enabled && !experienceVisible\}/);
});
