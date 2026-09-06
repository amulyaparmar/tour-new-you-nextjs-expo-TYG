import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const session = readFileSync(new URL("../src/practice/NativePracticeSession.tsx", import.meta.url), "utf8");
const skeleton = readFileSync(new URL("../src/practice/practice-loading.tsx", import.meta.url), "utf8");

test("the live practice session uses the Start New Tour glass header", () => {
  assert.match(session, /<GlassNavHeader title=\{title\} onBack=\{onBack\} \/>/);
  assert.match(skeleton, /<GlassNavHeader title=\{title\} onBack=\{onBack\} \/>/);
  assert.doesNotMatch(session, /TourBackButton/);
  assert.doesNotMatch(skeleton, /TourBackButton/);
});

test("the live practice session uses CustomText and shared UI tokens", () => {
  assert.match(session, /<CustomText /);
  assert.match(session, /BACKGROUND/);
  assert.match(session, /CARD/);
  assert.match(session, /ACCENT/);
  assert.doesNotMatch(session, /from "react-native"[^;]*\bText\b/);
});

test("the live practice session does not use outlined chrome", () => {
  assert.doesNotMatch(session, /borderWidth:\s*1/);
  assert.doesNotMatch(session, /borderTopWidth:\s*1/);
  assert.doesNotMatch(session, /borderBottomWidth:\s*1/);
  assert.doesNotMatch(skeleton, /borderWidth:\s*1/);
  assert.doesNotMatch(session, /C\.border/);
});

test("the ready practice session uses About your prospect and Start Practice", () => {
  assert.match(session, /About your prospect/);
  assert.match(session, /Start Practice/);
  assert.doesNotMatch(session, /Start when you.re ready/);
  assert.doesNotMatch(session, /chatbubble-ellipses-outline/);
  assert.doesNotMatch(session, /Start live practice/);
});

test("the goals sheet matches the filters modal chrome", () => {
  assert.match(session, /textStyle="hero">Goals/);
  assert.match(session, /LiquidGlassIconButton/);
  assert.match(session, /accessibilityLabel="Close goals"/);
  assert.match(session, /checkbox-outline/);
});

test("the live speaking dock floats above the footer controls", () => {
  assert.match(session, /function PracticeLiveDock/);
  assert.match(session, /liveDock=/);
  assert.match(session, /styles\.turnRow/);
  assert.doesNotMatch(session, /styles\.liveStatus/);
  assert.doesNotMatch(session, /agentLine/);
  assert.doesNotMatch(session, /transcriptCard/);
});

test("ended practice uses Transcript and Report tabs instead of a score card", () => {
  assert.match(session, /SessionModeTabs/);
  assert.match(session, /label: "Transcript"/);
  assert.match(session, /label: "Report"/);
  assert.doesNotMatch(session, /Back to practice/);
  assert.doesNotMatch(session, /scoreCard/);
});

test("the practice report uses Score, Summary, and Goals cards", () => {
  assert.match(session, /Score/);
  assert.match(session, /Summary/);
  assert.match(session, /reportLabel/);
  assert.match(session, /WAYPOINTS_EVAL_KEYWORD/);
  assert.doesNotMatch(session, /Practice complete/);
});

test("ended practice scrolls to the screen bottom instead of reserving a footer inset", () => {
  assert.doesNotMatch(session, /paddingBottom:\s*footer \? 0 : footerPad/);
  assert.match(session, /callState === "ended"\s*\n\s*\? insets\.bottom \+ 8/);
});

test("the practice list opens a native stack session instead of swapping in place", () => {
  const list = readFileSync(new URL("../src/practice/PracticeSessionsScreen.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(list, /onOpenSession/);
  assert.doesNotMatch(list, /if \(reviewAttemptId\)/);
  assert.doesNotMatch(list, /setLivePractice/);
  assert.match(app, /name="PracticeSession"/);
  assert.match(app, /type: "practice-session"/);
  assert.match(app, /animation: "slide_from_right"/);
});
