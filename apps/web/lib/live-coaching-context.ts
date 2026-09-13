import "server-only";
import { getRubricById } from "./rubrics";
import { findPropertyForSessionKey } from "./admin-auth";
import { getSupabaseServiceClient } from "./supabase";
import { coachingPricingSnapshot, type CoachingPricingRow } from "./live-coaching-pricing";

const pricingCache = new Map<string, {
  expires: number;
  value: Promise<ReturnType<typeof coachingPricingSnapshot>>;
}>();

/** Called after session authorization. Coalesce lookups, including missing/error results. */
export function liveCoachingPricing(propertyKey?: string | null) {
  if (!propertyKey) return Promise.resolve(null);
  const cached = pricingCache.get(propertyKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const signal = AbortSignal.timeout(1500);
  const lookup = async () => {
    const id = propertyKey.toLowerCase().startsWith("community:")
      ? (await findPropertyForSessionKey(propertyKey))?.id : propertyKey;
    if (!id || signal.aborted) return null;
    const { data, error } = await getSupabaseServiceClient()
      .from("propertiesTYG")
      .select("id,name,website,extracted_pricing")
      .eq("id", id)
      .abortSignal(signal)
      .maybeSingle<CoachingPricingRow>();
    return error ? null : coachingPricingSnapshot(data);
  };
  // The legacy identity resolver does not accept an AbortSignal; bound its wait too.
  let onAbort: () => void;
  const timeout = new Promise<null>(resolve => {
    onAbort = () => resolve(null);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  const value = Promise.race([lookup().catch(() => null), timeout])
    .finally(() => signal.removeEventListener("abort", onAbort));
  if (pricingCache.size >= 100) pricingCache.delete(pricingCache.keys().next().value!);
  pricingCache.set(propertyKey, { expires: Date.now() + 60000, value });
  return value;
}

const cache = new Map<string, { expires: number; value: string }>();

/** Cache rubric guidance only; session authorization still runs on every request. */
export async function liveCoachingRubric(rubricId?: string | null, structured = false) {
  if (!rubricId) return "";
  const key = `${structured ? "structured:" : ""}${rubricId}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const rubric = await getRubricById(rubricId);
  if (!rubric) return "";
  const sections = rubric.definition.sections.map(section => ({
    name: section.name,
    criteria: section.items.map(item => item.text),
  }));
  const value = structured ? JSON.stringify(sections.map(s => ({ name: s.name.slice(0, 100), criteria: s.criteria.map(c => c.slice(0, 400)) })))
    : JSON.stringify(sections).slice(0, 3000);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + 60000, value });
  return value;
}
