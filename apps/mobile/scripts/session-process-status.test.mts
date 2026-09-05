import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const phases = readFileSync(
  new URL("../src/conversationPhases.ts", import.meta.url),
  "utf8",
);
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const card = readFileSync(
  new URL("../src/components/session/session-process-status.tsx", import.meta.url),
  "utf8",
);

test("session detail process cards share one status shell", () => {
  assert.match(app, /<SessionStatusCard\s+tone="preparing"/);
  assert.match(app, /<SessionStatusCard\s+tone="synced"/);
  assert.match(app, /<SessionStatusCard\s+tone="failed"/);
  assert.match(card, /borderRadius: LARGE_CORNER/);
  assert.match(card, /CustomText/);
});

test("preparing copy uses sentence-case stage titles", () => {
  assert.match(phases, /Preparing your tour/);
  assert.match(phases, /Creating a transcript/);
  assert.match(phases, /Scoring the conversation/);
  assert.match(app, /title=\{processingTitle\(status\)\}/);
  assert.match(app, /<ProcessingTimeline status=\{status\} \/>/);
});

test("failed and synced session cards name the state in the title", () => {
  assert.match(app, /title="Failed"/);
  assert.match(app, /title="Synced"/);
  assert.match(app, /Retry analysis/);
  assert.match(app, /Analysis complete\. Opening results/);
});
