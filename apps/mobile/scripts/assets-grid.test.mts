import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const materials = app.slice(app.indexOf("function MaterialsScreen"));

test("the assets page shows three cards per row on iPad and two on phone", () => {
  assert.match(materials, /Platform\.OS === "ios" && Platform\.isPad \? 3 : 2/);
  assert.match(materials, /width: assetCardWidth/);
  assert.doesNotMatch(materials, /Dimensions\.get\("window"\)\.width - 40\) \/ 2/);
});
