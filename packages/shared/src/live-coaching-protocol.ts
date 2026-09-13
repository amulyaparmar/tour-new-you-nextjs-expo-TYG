export type LiveCoachingEvidence = {
  id: string;
  summary: string;
  evidenceIds: string[];
};

export type LiveCoachingSignal = LiveCoachingEvidence & {
  type: "need" | "question" | "objection" | "buying_intent" | "reaction";
  status: "open" | "handled";
};

export type LiveCoachingObservation = LiveCoachingEvidence & {
  type: "positive_technique" | "technique_gap" | "rubric_opportunity";
  status: "open" | "handled";
};

export type LiveCoachingNeed = LiveCoachingEvidence & {
  status: "open" | "addressed" | "unresolved";
};

export type LiveCoachingQuestion = LiveCoachingEvidence & {
  status: "open" | "answered" | "deferred";
};

export type LiveCoachingObjection = LiveCoachingEvidence & {
  status: "open" | "handled";
};

export type LiveCoachingState = {
  phase: "opening" | "discovery" | "walkthrough" | "decision" | "next_step";
  activeMoment: "normal" | "question" | "objection" | "buying_signal" | "reaction" | "coaching_opportunity";
  needs: LiveCoachingNeed[];
  questions: LiveCoachingQuestion[];
  objections: LiveCoachingObjection[];
  handledTopics: LiveCoachingEvidence[];
  signals: LiveCoachingSignal[];
  observations: LiveCoachingObservation[];
};

export type LiveCoachingStatePatch = LiveCoachingState & { removeIds: string[] };

export type LiveCoachingOption = {
  type: "ask" | "say" | "try" | "remember";
  label: string;
  sayThis: string;
  factIds: string[];
};

export type LiveCoachingItem = {
  sourceId: string;
  sourceKind: "prospect_signal" | "coaching_observation";
  coachingType: "reinforce" | "discover" | "connect" | "recover" | "advance";
  topicKey: string;
  headline: string;
  feedback: string;
  whyItMatters: string;
  evidenceTurnIds: string[];
  rubricGoalIndexes: number[];
  expiresInMs: number;
  options: [LiveCoachingOption, LiveCoachingOption];
};

export type LiveCoachingRequest = {
  protocolVersion: 4;
  revision: string;
  elapsed: number;
  trigger: {
    type: "turn_finalized" | "direct_question" | "objection" | "buying_signal" | "presence_review";
    priority: "normal" | "urgent";
    turnIds: string[];
  };
  state: LiveCoachingState;
  newTurns: { id: string; speaker: string; text: string; time: number }[];
  recentTurns: { id: string; speaker: string; text: string; time: number }[];
  currentGuidance: { id: string; at: number; item: LiveCoachingItem } | null;
  recentGuidance: { at: number; headline: string; coachingType: LiveCoachingItem["coachingType"]; topicKey: string; sourceId: string }[];
  notes: string;
  eagerness: import("./live-coaching").CoachingEagerness;
};

export type LiveCoachingResponse = {
  protocolVersion: 4;
  revision: string;
  statePatch: LiveCoachingStatePatch;
  decision: {
    visibility: "observe" | "nudge" | "intervene";
    reasonCode: "question" | "objection" | "unresolved_need" | "buying_signal" | "reaction" | "personalization" | "discovery_gap" | "rubric_gap" | "positive_technique" | "progress" | "already_handled" | "conversation_progressing" | "insufficient_value";
    reason: string;
    item: LiveCoachingItem | null;
  };
};

export const emptyLiveCoachingState = (): LiveCoachingState => ({
  phase: "opening",
  activeMoment: "normal",
  needs: [],
  questions: [],
  objections: [],
  handledTopics: [],
  signals: [],
  observations: [],
});

export function applyLiveCoachingStatePatch(current: LiveCoachingState, patch: LiveCoachingStatePatch): LiveCoachingState {
  const removed = new Set(patch.removeIds);
  const merge = <T extends LiveCoachingEvidence>(existing: T[], updates: T[], limit: number) => {
    const byId = new Map(existing.filter((entry) => !removed.has(entry.id)).map((entry) => [entry.id, entry]));
    for (const entry of updates) byId.set(entry.id, entry);
    return [...byId.values()].slice(-limit);
  };
  return {
    phase: patch.phase,
    activeMoment: patch.activeMoment,
    needs: merge(current.needs, patch.needs, 6),
    questions: merge(current.questions, patch.questions, 6),
    objections: merge(current.objections, patch.objections, 4),
    handledTopics: merge(current.handledTopics, patch.handledTopics, 8),
    signals: merge(current.signals, patch.signals, 10),
    observations: merge(current.observations, patch.observations, 10),
  };
}
