import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createJiti } from "jiti";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, { alias: { "server-only": join(dirname(require.resolve("server-only")), "empty.js") } });
const { liveCoachingPrompt, liveCoachingRequestSchema, validateLiveCoachingResponse } =
  await jiti.import("./live-coaching-prompt.ts");

const state = { phase: "discovery", activeMoment: "normal", needs: [], questions: [], objections: [], handledTopics: [], signals: [], observations: [] };
const input = { protocolVersion: 4, revision: "1", elapsed: 30, trigger: { type: "turn_finalized", priority: "normal", turnIds: ["p1"] },
  state, newTurns: [{ id: "p1", speaker: "Prospect", time: 25, text: "I need somewhere quiet to study." }],
  recentTurns: [{ id: "p1", speaker: "Prospect", time: 25, text: "I need somewhere quiet to study." }],
  currentGuidance: null, recentGuidance: [], notes: "", eagerness: "balanced" };
const references = { facts: [], rubricGoals: ["Personalize the presentation"], policy: "Agent statements are working truth." };
const signal = { id: "need-study", summary: "Needs quiet study space", evidenceIds: ["p1"], type: "need", status: "open" };
const base = { statePatch: { ...state, needs: [{ id: "need-study", summary: "Needs quiet study space", evidenceIds: ["p1"], status: "open" }],
    signals: [signal], removeIds: [] },
  decision: { visibility: "nudge", reasonCode: "personalization", reason: "Connect the walkthrough to the stated need.", item: {
    sourceId: "need-study", sourceKind: "prospect_signal", coachingType: "connect", topicKey: "quiet-study",
    headline: "Connect this space to studying", feedback: "They gave you a clear daily-life priority.",
    whyItMatters: "A specific connection makes the tour feel designed around them.", evidenceTurnIds: ["p1"], rubricGoalIndexes: [0], expiresInMs: 15000,
    options: [
      { type: "ask", label: "Explore the routine", sayThis: "What does an ideal study setup look like for you?", factIds: [] },
      { type: "try", label: "Use their answer", sayThis: "Connect their answer to the next relevant space you show.", factIds: [] },
    ] } } };

test("keeps a grounded two-option coaching moment", () => {
  const output = validateLiveCoachingResponse(base, input, references);
  assert.equal(output.decision.visibility, "nudge");
  assert.equal(output.decision.item.options.length, 2);
  assert.equal(output.decision.item.feedback, base.decision.item.feedback);
});

test("accepts only the current live coaching protocol", () => {
  assert.equal(liveCoachingRequestSchema.safeParse(input).success, true);
  assert.equal(liveCoachingRequestSchema.safeParse({ ...input, protocolVersion: 3 }).success, false);
});

test("blocks premature closing without explicit buying intent", () => {
  const value = structuredClone(base);
  value.decision.item.coachingType = "advance";
  value.decision.item.options[0].sayThis = "Let's go back to the desk and start your application.";
  const output = validateLiveCoachingResponse(value, input, references);
  assert.equal(output.decision.visibility, "observe");
  assert.match(output.decision.reason, /explicit prospect buying intent/);
});

test("does not correct the representative without contradictory evidence", () => {
  const value = structuredClone(base);
  value.decision.item.feedback = "That information was incorrect.";
  const output = validateLiveCoachingResponse(value, input, references);
  assert.equal(output.decision.visibility, "observe");
  assert.match(output.decision.reason, /contradictory evidence/);
});

test("replaces unsupported property claims with fact-free coaching actions", () => {
  const value = structuredClone(base);
  value.decision.item.options[1] = { type: "say", label: "Describe the package", sayThis: "Utilities and parking are included in this rate.", factIds: [] };
  const output = validateLiveCoachingResponse(value, input, references);
  assert.equal(output.decision.visibility, "nudge");
  assert.equal(output.decision.item.options[1].type, "try");
  assert.doesNotMatch(output.decision.item.options[1].sayThis, /included/);
});

test("prompt makes missing context neutral rather than a verification warning", () => {
  const prompt = liveCoachingPrompt(input, references).instructions;
  assert.match(prompt, /unknown to you, not wrong/);
  assert.match(prompt, /Never tell the representative to verify/);
});
