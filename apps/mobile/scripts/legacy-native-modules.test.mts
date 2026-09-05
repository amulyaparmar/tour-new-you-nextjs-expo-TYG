import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { wrapLegacyNativeModules } = require("../src/practice/native-shims/wrapLegacyNativeModules.js");
const { isDailyNativeBridgeOrigin } = require("../src/practice/native-shims/dailyNativeBridgeOrigin.js");

test("legacy NativeModules resolve RCT modules through TurboModuleRegistry", () => {
  const nativeModules: Record<string, unknown> = { KeepMe: { ok: true } };
  const turbo: Record<string, unknown> = { WebRTCModule: { addListener() {} } };
  const wrapped = wrapLegacyNativeModules(nativeModules, (name: string) => turbo[name] ?? null);

  assert.equal(wrapped.KeepMe, nativeModules.KeepMe);
  assert.equal(wrapped.WebRTCModule, turbo.WebRTCModule);
  assert.equal(wrapped.Missing, undefined);
});

test("legacy NativeModules lookup does not recurse when turboGet reads NativeModules", () => {
  const nativeModules: Record<string, unknown> = {};
  let wrapped: Record<string, unknown> = nativeModules;
  wrapped = wrapLegacyNativeModules(nativeModules, (name: string) => wrapped[name] ?? { turbo: name });
  assert.deepEqual(wrapped.DailyNativeUtils, { turbo: "DailyNativeUtils" });
});

test("Metro routes Daily/WebRTC react-native imports through the legacy shim", () => {
  assert.equal(
    isDailyNativeBridgeOrigin("/app/node_modules/@daily-co/react-native-webrtc/src/EventEmitter.ts"),
    true,
  );
  assert.equal(
    isDailyNativeBridgeOrigin("/app/node_modules/@daily-co/react-native-daily-js/dist/index.js"),
    true,
  );
  assert.equal(
    isDailyNativeBridgeOrigin("/app/node_modules/react-native-background-timer/index.js"),
    true,
  );
  assert.equal(isDailyNativeBridgeOrigin("/app/App.tsx"), false);

  const metro = readFileSync(new URL("../metro.config.js", import.meta.url), "utf8");
  assert.match(metro, /react-native-legacy-modules\.js/);
  assert.match(metro, /moduleName === "react-native"/);
});

test("selecting a live practice scenario does not crash if Daily fails to load", () => {
  const source = readFileSync(new URL("../src/practice/PracticeSessionsScreen.tsx", import.meta.url), "utf8");
  assert.match(source, /NativePracticeSession failed to load/);
  assert.match(source, /loaded\.NativePracticeSession \?\? null/);
  assert.match(source, /Practice unavailable/);
});

test("the practice call SDK is loaded lazily so picking a scenario cannot crash Metro", () => {
  const source = readFileSync(new URL("../src/practice/NativePracticeSession.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import Daily from "@daily-co\/react-native-daily-js"/);
  assert.match(source, /function loadDaily\(/);
  assert.match(source, /loadDaily\(\)\.createCallObject/);
});
