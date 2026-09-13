export type CoachingItem = {
  kind: "ask" | "know" | "adjust";
  type: "discovery" | "information" | "caution" | "connection" | "feedback";
  text: string;
  whyNow: string;
  topic: string;
  sourceTurnIds: string[];
  headline?: string;
  sayIt?: string;
  moveKind?: "correct" | "ask" | "say" | "lead" | "reinforce";
  coachingId?: string;
  coachingAt?: number;
  coachingKind?: "reactive" | "checkpoint";
  preparedGuidance?: {
    feedback?: string;
    whyNow?: string;
    keepInMind?: string;
    nextMove?: string;
    sayThis?: string;
    options?: Array<{
      type: "ask" | "say" | "try" | "remember";
      label: string;
      sayThis: string;
    }>;
  };
};

export type CoachingEagerness = "calm" | "balanced" | "active";
