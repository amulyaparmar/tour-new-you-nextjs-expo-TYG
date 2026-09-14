import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createJiti } from "jiti";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
  alias: { "server-only": join(dirname(require.resolve("server-only")), "empty.js") },
});
const { geminiResponseJsonSchema } = await jiti.import("./live-coaching-provider.ts");
const { liveCoachingResponseSchema } = await jiti.import("./live-coaching-prompt.ts");

function findProperty(schema, name) {
  if (!schema || typeof schema !== "object") return null;
  if (schema.properties?.[name]) return schema.properties[name];
  for (const value of Object.values(schema)) {
    const found = findProperty(value, name);
    if (found) return found;
  }
  return null;
}

test("preserves Gemini-supported array bounds in the response schema", () => {
  const schema = geminiResponseJsonSchema(liveCoachingResponseSchema);
  assert.equal(findProperty(schema, "needs")?.maxItems, 5);
  assert.equal(findProperty(schema, "questions")?.maxItems, 5);
  assert.equal(findProperty(schema, "rubricGoalIndexes")?.maxItems, 2);
  assert.equal(findProperty(schema, "evidenceTurnIds")?.minItems, 1);
  assert.equal(findProperty(schema, "evidenceTurnIds")?.maxItems, 4);
  assert.equal(findProperty(schema, "options")?.minItems, 2);
  assert.equal(findProperty(schema, "options")?.maxItems, 2);
});
