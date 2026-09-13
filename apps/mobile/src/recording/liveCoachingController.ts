import {
  applyLiveCoachingStatePatch,
  emptyLiveCoachingState,
  type CoachingEagerness,
  type CoachingItem,
  type LiveCoachingItem,
  type LiveCoachingRequest,
  type LiveCoachingResponse,
  type LiveCoachingState,
} from "@tour/shared";

export type CoachingTurn = {
  id: string;
  speaker: string;
  text: string;
  time: number;
  isInterim?: boolean;
};

export type CoachingTip = {
  items: CoachingItem[];
  text: string;
  alternatives?: string[];
  sourceTurnIds: string[];
};

export type CoachingTrace = {
  event: string;
  revision?: string;
  reason?: string;
  items?: CoachingItem[];
};

export class CoachingRequestError extends Error {
  readonly retryable: boolean;
  readonly retryAfterMs: number;

  constructor(retryable: boolean, retryAfterMs = 0) {
    super("Coaching unavailable");
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export function coachingHttpError(status: number, retryAfter: string | null, now = Date.now()) {
  const value = retryAfter?.trim();
  const delay = !value
    ? 0
    : /^-?\d+(?:\.\d+)?$/.test(value)
      ? Number(value) * 1000
      : Date.parse(value) - now;
  return new CoachingRequestError(
    status === 408 || status === 425 || status === 429 || status >= 500 && status <= 599,
    Number.isFinite(delay) ? Math.max(0, delay) : 0,
  );
}

type Host = {
  now(): number;
  request(input: LiveCoachingRequest, signal: AbortSignal): Promise<LiveCoachingResponse>;
  change(tip: CoachingTip | null, unavailable: boolean, history: CoachingTip[]): void;
  trace?(event: CoachingTrace): void;
  interaction?(event: "shown" | "tap" | "dismiss", item: CoachingItem): void;
};

const pacing: Record<CoachingEagerness, { evaluate: number; presence: number }> = {
  calm: { evaluate: 8, presence: 90 },
  balanced: { evaluate: 6, presence: 60 },
  active: { evaluate: 4, presence: 45 },
};
const turnSettleMs = 1200;
const ignoredWords = new Set("a an and are as at be but by can do for from has have i in is it let me of on or that the their them this to we what when where which with you your".split(" "));
const signature = (turn: CoachingTurn) => JSON.stringify([turn.id, turn.speaker, turn.time, turn.text]);
const contentWords = (text: string) => new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
  .filter((word) => word.length > 2 && !ignoredWords.has(word)));

function suggestionsOverlap(left: LiveCoachingItem, right: LiveCoachingItem) {
  const wordsFor = (item: LiveCoachingItem) => contentWords([
    item.headline,
    ...item.options.flatMap((option) => [option.label, option.sayThis]),
  ].join(" "));
  const a = wordsFor(left), b = wordsFor(right);
  if (!a.size || !b.size) return false;
  const common = [...a].filter((word) => b.has(word)).length;
  return common / Math.min(a.size, b.size) >= 0.6;
}

function newerSpeechSupersedes(item: LiveCoachingItem, turns: CoachingTurn[]) {
  if (!turns.length) return false;
  const candidate = contentWords([item.headline, ...item.options.map((option) => option.sayThis)].join(" "));
  const newer = contentWords(turns.map((turn) => turn.text).join(" "));
  const common = [...candidate].filter((word) => newer.has(word)).length;
  return common >= 2 || candidate.size > 0 && common / candidate.size >= 0.35;
}

function toCoachingItem(item: LiveCoachingItem, id: string, at: number, checkpoint: boolean): CoachingItem {
  const type: CoachingItem["type"] = item.coachingType === "discover" ? "discovery"
    : item.coachingType === "recover" ? "caution"
      : item.coachingType === "reinforce" ? "feedback" : "connection";
  const kind: CoachingItem["kind"] = type === "discovery" ? "ask" : type === "caution" ? "know" : "adjust";
  const moveKind: NonNullable<CoachingItem["moveKind"]> = item.coachingType === "discover" ? "ask"
    : item.coachingType === "reinforce" ? "reinforce"
      : item.options.some((option) => option.type === "say") ? "say" : "lead";
  return {
    kind,
    type,
    text: item.headline,
    headline: item.headline,
    whyNow: item.whyItMatters,
    topic: item.topicKey,
    sourceTurnIds: item.evidenceTurnIds,
    sayIt: item.options.find((option) => option.type === "say")?.sayThis,
    moveKind,
    coachingId: id,
    coachingAt: at,
    coachingKind: checkpoint ? "checkpoint" : "reactive",
    preparedGuidance: {
      feedback: item.feedback,
      whyNow: item.whyItMatters,
      options: item.options.map(({ type: optionType, label, sayThis }) => ({ type: optionType, label, sayThis })),
    },
  };
}

/** One model call updates the bounded session state and decides whether to coach. */
export class LiveCoachingController {
  private enabled = false;
  private activation = 0;
  private sequence = 0;
  private turns: CoachingTurn[] = [];
  private evaluated = new Map<string, string>();
  private state: LiveCoachingState = emptyLiveCoachingState();
  private elapsed = 0;
  private notes = "";
  private eagerness: CoachingEagerness = "balanced";
  private lastRequestAt = -Infinity;
  private lastPresenceAt = 0;
  private lastDisplayAt = -Infinity;
  private lastPresenceKey = "";
  private pendingKey = "";
  private pendingSince = -Infinity;
  private retryAfter = 0;
  private failures = 0;
  private blocked = false;
  private inFlight: AbortController | null = null;
  private current: { id: string; at: number; item: LiveCoachingItem } | null = null;
  private retained: { id: string; at: number; item: LiveCoachingItem; visibility: "nudge" | "intervene" }[] = [];
  private tip: CoachingTip | null = null;
  private history: CoachingTip[] = [];

  constructor(private host: Host) {}

  configure(enabled: boolean, incoming: CoachingTurn[], elapsed: number, notes: string, eagerness: CoachingEagerness) {
    const previous = new Map(this.turns.map((turn) => [turn.id, signature(turn)]));
    this.turns = incoming.filter((turn) => !turn.isInterim && turn.text.trim())
      .map((turn) => ({ id: turn.id, speaker: turn.speaker, text: turn.text.slice(0, 12000), time: turn.time }))
      .sort((a, b) => a.time - b.time);
    this.elapsed = elapsed;
    this.notes = notes.slice(0, 2000);
    this.eagerness = eagerness;
    const pendingTurns = this.turns.filter((turn) => this.evaluated.get(turn.id) !== signature(turn));
    const pendingKey = JSON.stringify(pendingTurns.map(signature));
    if (!pendingTurns.length) {
      this.pendingKey = "";
      this.pendingSince = -Infinity;
    } else if (pendingKey !== this.pendingKey) {
      this.pendingKey = pendingKey;
      this.pendingSince = this.host.now();
    }
    const next = new Map(this.turns.map((turn) => [turn.id, signature(turn)]));
    const changed = new Set([...previous].filter(([id, value]) => !next.has(id) || next.get(id) !== value).map(([id]) => id));
    if (changed.size) {
      const keepEvidence = <T extends { evidenceIds: string[] }>(entries: T[]) => entries.filter((entry) => !entry.evidenceIds.some((id) => changed.has(id)));
      this.state = { ...this.state,
        needs: keepEvidence(this.state.needs), questions: keepEvidence(this.state.questions), objections: keepEvidence(this.state.objections),
        handledTopics: keepEvidence(this.state.handledTopics), signals: keepEvidence(this.state.signals), observations: keepEvidence(this.state.observations) };
      this.history = this.history.filter((entry) => !entry.sourceTurnIds.some((id) => changed.has(id)));
      this.retained = this.retained.filter((entry) => !entry.item.evidenceTurnIds.some((id) => changed.has(id)));
      if (this.current?.item.evidenceTurnIds.some((id) => changed.has(id))) this.current = null;
      if (this.tip && !this.history.includes(this.tip)) this.tip = null;
      this.host.change(this.tip, false, this.history);
    }
    if (enabled !== this.enabled) {
      this.activation++;
      this.inFlight?.abort();
      this.inFlight = null;
      this.retryAfter = 0;
      this.failures = 0;
      this.blocked = false;
      this.pendingKey = "";
      this.pendingSince = -Infinity;
      if (enabled && !this.evaluated.size) {
        // A coach enabled mid-tour starts from the next finalized turn rather than replaying old advice.
        this.evaluated = new Map(this.turns.map((turn) => [turn.id, signature(turn)]));
        this.lastPresenceKey = JSON.stringify([...this.evaluated]);
        this.lastPresenceAt = elapsed;
      }
    }
    this.enabled = enabled;
  }

  tick() {
    const now = this.host.now();
    if (!this.enabled || this.blocked || !this.turns.length) return;
    const recentTurns = this.turns.filter((turn) => turn.time >= this.elapsed - 90).slice(-160);
    const recentIds = new Set(recentTurns.map((turn) => turn.id));
    const newTurns = recentTurns.filter((turn) => this.evaluated.get(turn.id) !== signature(turn));
    const pendingKey = JSON.stringify(newTurns.map(signature));
    if (!newTurns.length) {
      this.pendingKey = "";
      this.pendingSince = -Infinity;
    } else if (pendingKey !== this.pendingKey) {
      this.pendingKey = pendingKey;
      this.pendingSince = now;
    }
    if (this.inFlight || now < this.retryAfter) return;
    const requestGap = pacing[this.eagerness].evaluate;
    const dueForTurn = newTurns.length > 0
      && now - this.pendingSince >= turnSettleMs
      && (now - this.lastRequestAt) / 1000 >= requestGap;
    const presenceKey = JSON.stringify(recentTurns.map(signature));
    const dueForPresence = newTurns.length === 0 && presenceKey !== this.lastPresenceKey
      && this.elapsed - this.lastPresenceAt >= pacing[this.eagerness].presence
      && this.elapsed - this.lastDisplayAt >= pacing[this.eagerness].presence
      && (now - this.lastRequestAt) / 1000 >= pacing[this.eagerness].evaluate;
    if (!dueForTurn && !dueForPresence) return;

    const requestTurns = dueForTurn ? newTurns : [];
    // Transcript semantics belong to the model. The client reports only that a
    // finalized batch exists so lexical shortcuts cannot bias its judgment.
    const requestTrigger: LiveCoachingRequest["trigger"] = dueForPresence
      ? { type: "presence_review", priority: "normal", turnIds: recentTurns.slice(-4).map((turn) => turn.id) }
      : { type: "turn_finalized", priority: "normal", turnIds: requestTurns.map((turn) => turn.id) };
    const revision = String(++this.sequence), activation = this.activation;
    const request: LiveCoachingRequest = {
      protocolVersion: 4,
      revision,
      elapsed: this.elapsed,
      trigger: requestTrigger,
      state: this.state,
      newTurns: requestTurns.map(({ id, speaker, text, time }) => ({ id, speaker, text, time })),
      recentTurns: recentTurns.map(({ id, speaker, text, time }) => ({ id, speaker, text, time })),
      currentGuidance: this.current,
      recentGuidance: this.retained.slice(-8).map((entry) => ({ at: entry.at, headline: entry.item.headline,
        coachingType: entry.item.coachingType, topicKey: entry.item.topicKey, sourceId: entry.item.sourceId })),
      notes: this.notes,
      eagerness: this.eagerness,
    };
    const sourceSignatures = new Map(requestTurns.map((turn) => [turn.id, signature(turn)]));
    const controller = new AbortController();
    this.inFlight = controller;
    this.lastRequestAt = now;
    if (dueForPresence) this.lastPresenceAt = this.elapsed;
    const timeout = setTimeout(() => controller.abort(), 12000);
    this.host.trace?.({ event: "request-started", revision });
    void this.host.request(request, controller.signal).then((response) => {
      if (controller.signal.aborted || !this.enabled || activation !== this.activation) return;
      if (response.protocolVersion !== 4 || response.revision !== revision) throw new CoachingRequestError(false);
      this.state = applyLiveCoachingStatePatch(this.state, response.statePatch);
      for (const [id, value] of sourceSignatures) if (recentIds.has(id)) this.evaluated.set(id, value);
      this.lastPresenceKey = presenceKey;
      this.failures = 0;
      this.retryAfter = 0;
      this.blocked = false;
      const decision = response.decision;
      if (decision.visibility === "observe" || !decision.item) {
        if (decision.reasonCode === "already_handled") { this.current = null; this.tip = null; }
        this.host.trace?.({ event: "observed", revision, reason: decision.reasonCode });
        this.host.change(this.tip, false, this.history);
        return;
      }
      const duplicate = this.retained.slice(-12).some((entry) =>
        (entry.item.sourceId === decision.item!.sourceId || entry.item.topicKey === decision.item!.topicKey && this.elapsed - entry.at <= 90)
        && suggestionsOverlap(entry.item, decision.item!));
      if (duplicate) {
        this.host.trace?.({ event: "discarded", revision, reason: "duplicate-action" });
        this.host.change(this.tip, false, this.history);
        return;
      }
      const id = `${activation}:${revision}`;
      const retained = { id, at: this.elapsed, item: decision.item, visibility: decision.visibility };
      const displayed = toCoachingItem(decision.item, id, this.elapsed, dueForPresence);
      const tip = { items: [displayed], text: displayed.text, alternatives: decision.item.options.map((option) => option.sayThis),
        sourceTurnIds: decision.item.evidenceTurnIds };
      this.retained = [...this.retained, retained].slice(-100);
      this.history = [...this.history, tip].slice(-100);
      const newerTurns = this.turns.filter((turn) => !request.recentTurns.some((sent) => sent.id === turn.id && sent.text === turn.text));
      if (newerSpeechSupersedes(decision.item, newerTurns)) {
        this.host.trace?.({ event: "retained", revision, reason: "newer-turn-superseded-popup", items: [displayed] });
        this.host.change(this.tip, false, this.history);
        return;
      }
      this.current = retained;
      this.tip = tip;
      this.lastDisplayAt = this.elapsed;
      this.host.trace?.({ event: "displayed", revision, items: [displayed] });
      this.host.interaction?.("shown", displayed);
      this.host.change(this.tip, false, this.history);
    }).catch((error: unknown) => {
      if (activation !== this.activation || !this.enabled) return;
      this.blocked = error instanceof CoachingRequestError && !error.retryable;
      this.retryAfter = this.host.now() + Math.max(Math.min(30000, 3000 * 2 ** Math.min(this.failures++, 4)),
        error instanceof CoachingRequestError ? error.retryAfterMs : 0);
      this.host.trace?.({ event: "request-failed", revision });
      // Transient coaching failures are deliberately silent in the live UI.
      this.host.change(this.tip, false, this.history);
    }).finally(() => {
      clearTimeout(timeout);
      if (this.inFlight === controller) this.inFlight = null;
    });
  }

  interaction(event: "tap" | "dismiss", item: CoachingItem) { this.host.interaction?.(event, item); }
  dismiss() { this.tip = null; this.host.change(null, false, this.history); }
  dispose() { this.enabled = false; this.activation++; this.inFlight?.abort(); this.inFlight = null; }
}
