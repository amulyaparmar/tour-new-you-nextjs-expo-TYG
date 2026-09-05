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
