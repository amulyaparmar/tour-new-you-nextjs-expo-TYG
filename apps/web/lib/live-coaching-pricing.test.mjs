import test from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
const { coachingPricingSnapshot } = await createJiti(import.meta.url).import("./live-coaching-pricing.ts");
const row = {id:"property-1",name:"Test property",website:"https://example.com",extracted_pricing:null};
test("missing or malformed pricing is optional", () => {
  for (const value of [null, [], "bad", {}, {timestamp:"2026-09-08"}, {changes:["old offer"]}]) {
    assert.equal(coachingPricingSnapshot({...row,extracted_pricing:value}),null);
  }
});
test("preserves complete terms and property scope but excludes historical changes", () => {
  const pricing = {"4_bed":{"Shared":"$709 base rent"},specials:[{text:"Sign within 24 hours of application; one-time June credit.",started:"2026-09-06"}],timestamp:"2026-09-06T12:10:05Z",changes:["72-hour offer removed"],price_changes:{old:500}};
  const result = coachingPricingSnapshot({...row,extracted_pricing:pricing});
  assert.equal(result.propertyId,row.id);
  assert.equal(result.snapshotAt,pricing.timestamp);
  assert.deepEqual(result.pricing.specials,pricing.specials);
  assert.equal(result.pricing.changes,undefined);
  assert.equal(result.pricing.price_changes,undefined);
  assert.equal(result.status,"reference_only_requires_verification");
});
test("invalid dates stay unknown and oversized terms are omitted, not truncated", () => {
  assert.equal(coachingPricingSnapshot({...row,extracted_pricing:{timestamp:"invalid",rent:700}}).snapshotAt,null);
  assert.equal(coachingPricingSnapshot({...row,extracted_pricing:{specials:["x".repeat(12001)]}}),null);
});
