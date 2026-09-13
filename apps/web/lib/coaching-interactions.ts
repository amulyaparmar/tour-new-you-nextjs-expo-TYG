import { z } from "zod";
const schema = z.object({ event: z.enum(["shown", "tap", "dismiss"]), kind: z.enum(["correct", "ask", "say", "lead", "reinforce"]),
  suggestionId: z.string().min(1).max(100) }).strict();
const seen = new Map<string, number>();

/** Best-effort per-instance dedupe. Dashboard aggregation must also account for replicas/retries. */
export function acceptCoachingInteraction(scope: string, value: unknown, now = Date.now()) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return { valid: false, event: null };
  for (const [key, at] of seen) if (now - at > 3600000) seen.delete(key);
  const key = `${scope}:${parsed.data.suggestionId}:${parsed.data.event}`;
  if (seen.has(key)) return { valid: true, event: null };
  if (seen.size >= 10000) seen.delete(seen.keys().next().value!);
  seen.set(key, now);
  return { valid: true, event: { event: parsed.data.event, kind: parsed.data.kind } };
}
