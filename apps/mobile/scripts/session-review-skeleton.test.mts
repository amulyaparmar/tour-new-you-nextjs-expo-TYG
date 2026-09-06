import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skeleton = readFileSync(
  new URL("../src/components/session/session-loading.tsx", import.meta.url),
  "utf8",
);
const pulse = readFileSync(
  new URL("../src/components/ui/use-skeleton-pulse.tsx", import.meta.url),
  "utf8",
);
const checkIn = readFileSync(
  new URL("../src/components/check-in/check-in-sheet.tsx", import.meta.url),
  "utf8",
);

test("the tour session skeleton uses the Start New Tour glass header", () => {
  assert.match(skeleton, /<GlassNavHeader title="Tour" onBack=\{onBack\} \/>/);
  assert.match(skeleton, /glassNavContentInset/);
  assert.doesNotMatch(skeleton, /TourBackButton/);
});

test("the tour session skeleton matches the Start New Tour pulse style", () => {
  assert.match(skeleton, /useSkeletonPulse/);
  assert.match(skeleton, /SkeletonPulse/);
  assert.match(skeleton, /HINT/);
  assert.match(skeleton, /CARD/);
  assert.match(skeleton, /LARGE_CORNER/);
  assert.match(skeleton, /borderCurve: "continuous"/);
  assert.doesNotMatch(skeleton, /from "@\/components\/ui\/skeleton"/);
  assert.doesNotMatch(skeleton, /FadeIn/);
});

test("the tour session skeleton follows the review page layout", () => {
  assert.match(skeleton, /tabTrack/);
  assert.match(skeleton, /playerDock/);
  assert.match(skeleton, /playBtn/);
  assert.match(skeleton, /accessibilityLabel="Loading tour"/);
});

test("the shared pulse matches the Start New Tour check-in skeleton", () => {
  assert.match(pulse, /toValue: 0\.58/);
  assert.match(pulse, /duration: 900/);
  assert.match(pulse, /useNativeDriver: true/);
  assert.match(checkIn, /toValue: 0\.58/);
  assert.match(checkIn, /duration: 900/);
});
