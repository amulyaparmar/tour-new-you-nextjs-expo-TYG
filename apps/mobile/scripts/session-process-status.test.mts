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

test("failed session card uses a page footer and analysis-failed title", () => {
  assert.match(app, /title="Analysis Failed"/);
  assert.match(app, /<SessionFailedFooter/);
  assert.match(app, /onFailedFooterChange=\{setFailedFooter\}/);
  assert.match(card, /Retry Analysis/);
  assert.match(card, /minHeight: 58/);
  assert.match(card, /borderRadius: 29/);
});
