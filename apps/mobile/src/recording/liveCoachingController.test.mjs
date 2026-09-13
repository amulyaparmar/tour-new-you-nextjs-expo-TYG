import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { LiveCoachingController } = await jiti.import("./liveCoachingController.ts");
const { coachingHttpError } = await jiti.import("./liveCoachingController.ts");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness() {
  let now = 0, turns = [], enabled = true;
  const calls = [], changes = [], traces = [];
  const controller = new LiveCoachingController({
    now: () => now,
    request: (input, signal) => new Promise((resolve, reject) => calls.push({ input, signal, resolve, reject })),
    change: (tip, unavailable, history) => changes.push({ tip, unavailable, history }),
    trace: (event) => traces.push(event),
  });
  const configure = () => controller.configure(enabled, turns, now / 1000, "", "balanced");
  configure();
  const response = (call, item = true) => ({ protocolVersion: 4, revision: call.input.revision,
    statePatch: { phase: "discovery", activeMoment: "coaching_opportunity", needs: [], questions: [], objections: [], handledTopics: [],
      signals: [{ id: "need-one", summary: "Needs quiet space", evidenceIds: ["t1"], type: "need", status: "open" }], observations: [], removeIds: [] },
    decision: item ? { visibility: "nudge", reasonCode: "personalization", reason: "Connect to the stated need.", item: {
      sourceId: "need-one", sourceKind: "prospect_signal", coachingType: "connect", topicKey: "quiet",
      headline: "Connect this to their routine", feedback: "They shared a clear need.", whyItMatters: "Personal relevance makes the feature memorable.",
      evidenceTurnIds: ["t1"], rubricGoalIndexes: [8], expiresInMs: 15000,
      options: [{ type: "ask", label: "Explore it", sayThis: "What would make this work for your routine?", factIds: [] },
        { type: "try", label: "Make the link", sayThis: "Connect their answer to the next relevant feature.", factIds: [] }] }
    } : { visibility: "observe", reasonCode: "conversation_progressing", reason: "No useful interruption.", item: null } });
  return { controller, calls, changes, traces,
    turns(value) { turns = value; configure(); },
    tick(ms = 12000) { now += ms; configure(); controller.tick(); },
    async answer(index = calls.length - 1, item = true) { calls[index].resolve(response(calls[index], item)); await flush(); },
    async fail(index = calls.length - 1, error = new Error("network")) { calls[index].reject(error); await flush(); },
  };
}

test("evaluates finalized turns and retains rich two-option coaching", async () => {
  const h = harness();
  try {
    h.turns([{ id: "t1", speaker: "Speaker A", time: 2, text: "I need somewhere quiet to study." }]);
    h.tick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].input.protocolVersion, 4);
    assert.equal(h.calls[0].input.newTurns[0].id, "t1");
    await h.answer();
    const latest = h.changes.at(-1);
    assert.equal(latest.unavailable, false);
    assert.equal(latest.history.length, 1);
    assert.equal(latest.tip.items[0].preparedGuidance.options.length, 2);
    assert.equal(latest.tip.items[0].preparedGuidance.feedback, "They shared a clear need.");
  } finally { h.controller.dispose(); }
});

test("coalesces transcript fragments and sends potentially loaded language as a neutral event", async () => {
  const h = harness();
  try {
    h.turns([{ id: "t1", speaker: "Speaker A", time: 2, text: "But this is too expensive. Can I apply anyway?" }]);
    h.tick(1000);
    assert.equal(h.calls.length, 0);
    h.tick(300);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.calls[0].input.trigger, { type: "turn_finalized", priority: "normal", turnIds: ["t1"] });
    await h.answer();
  } finally { h.controller.dispose(); }
});

test("observe stays silent and a transient provider failure does not show unavailable UI", async () => {
  const h = harness();
  try {
    h.turns([{ id: "t1", speaker: "Prospect", time: 2, text: "Okay." }]); h.tick(); await h.answer(0, false);
    assert.equal(h.changes.at(-1).tip, null);
    h.turns([{ id: "t1", speaker: "Prospect", time: 2, text: "Okay." }, { id: "t2", speaker: "Prospect", time: 20, text: "What about parking?" }]);
    h.tick(); await h.fail(1, coachingHttpError(503, null, 0));
    assert.equal(h.changes.at(-1).unavailable, false);
    assert.ok(h.traces.some((event) => event.event === "request-failed"));
  } finally { h.controller.dispose(); }
});

test("duplicate advice is retained only once", async () => {
  const h = harness();
  try {
    h.turns([{ id: "t1", speaker: "Prospect", time: 2, text: "I need somewhere quiet to study." }]); h.tick(); await h.answer();
    h.turns([{ id: "t1", speaker: "Prospect", time: 2, text: "I need somewhere quiet to study." },
      { id: "t2", speaker: "Prospect", time: 30, text: "Quiet is still most important." }]);
    h.tick();
    const call = h.calls[1];
    const reply = { ...h.calls[0] };
    call.resolve({ protocolVersion: 4, revision: call.input.revision,
      statePatch: { phase: "discovery", activeMoment: "coaching_opportunity", needs: [], questions: [], objections: [], handledTopics: [], signals: [], observations: [], removeIds: [] },
      decision: { visibility: "nudge", reasonCode: "personalization", reason: "Same need.", item: {
        sourceId: "need-one", sourceKind: "prospect_signal", coachingType: "connect", topicKey: "quiet",
        headline: "Connect this to their routine", feedback: "They repeated the need.", whyItMatters: "Keep it relevant.", evidenceTurnIds: ["t2"], rubricGoalIndexes: [], expiresInMs: 15000,
        options: [{ type: "ask", label: "Explore it", sayThis: "What would make this work for your routine?", factIds: [] },
          { type: "try", label: "Make the link", sayThis: "Connect their answer to the next relevant feature.", factIds: [] }] } } });
    await flush();
    assert.equal(h.changes.at(-1).history.length, 1);
    assert.ok(h.traces.some((event) => event.reason === "duplicate-action"));
    void reply;
  } finally { h.controller.dispose(); }
});
