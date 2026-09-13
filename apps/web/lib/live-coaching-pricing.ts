export type CoachingPricingRow = {
  id: string;
  name: string | null;
  website: string | null;
  extracted_pricing: unknown;
};

/** Omit an oversized snapshot rather than cutting off a price's qualifications. */
export function coachingPricingSnapshot(row: CoachingPricingRow | null) {
  const raw = row?.extracted_pricing;
  if (!row || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw).filter(([key]) => !["changes", "price_changes", "timestamp"].includes(key));
  if (!entries.length) return null;
  const pricing = Object.fromEntries(entries);
  if (JSON.stringify(pricing).length > 12000) return null;
  const timestamp = (raw as Record<string, unknown>).timestamp;
  return {
    propertyId: row.id,
    propertyName: row.name,
    source: "propertiesTYG.extracted_pricing",
    website: row.website,
    snapshotAt: typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp)) ? timestamp : null,
    pricing,
    status: "reference_only_requires_verification",
  };
}
