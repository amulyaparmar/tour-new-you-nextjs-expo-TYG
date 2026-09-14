import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
const materials = app.slice(app.indexOf("function MaterialsScreen"));

test("the assets page shows three cards per row on iPad and two on phone", () => {
  assert.match(materials, /Platform\.OS === "ios" && Platform\.isPad \? 3 : 2/);
  assert.match(materials, /width: assetCardWidth/);
  assert.doesNotMatch(materials, /Dimensions\.get\("window"\)\.width - 40\) \/ 2/);
});

test("read-only assets stay available in navigation, home, preview, and recording selection", () => {
  assert.match(app, /label: "Assets"/);
  assert.match(app, /<DashboardScreen[\s\S]*?onAssets=/);
  assert.match(materials, /<MaterialPreviewModal/);
  assert.match(materials, /Connected Tour Library/);
  assert.match(materials, /<LiquidGlassSearch/);
  assert.match(app, /function downloadMaterial/);
  assert.match(app, /function addRecordingAsset/);
  assert.match(api, /export async function fetchMaterials\(\)/);
});

test("asset creation controls, routes, and mobile APIs are absent", () => {
  assert.doesNotMatch(app, /Add New Asset|Add new asset/);
  assert.doesNotMatch(app, /AssetRecorder|VideoTourDetails|VideoTourFootage|VideoTourShotList/);
  assert.doesNotMatch(app, /ImagePicker|uploadMaterial|uploadPanoramaMaterial/);
  assert.doesNotMatch(api, /export async function uploadMaterial/);
  assert.doesNotMatch(api, /export async function uploadPanoramaMaterial/);
});
