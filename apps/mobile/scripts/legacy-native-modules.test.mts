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

test("legacy NativeModules treat bridgeless null as missing and consult TurboModuleRegistry", () => {
  const nativeModules: Record<string, unknown> = { WebRTCModule: null };
  const wrapped = wrapLegacyNativeModules(nativeModules, () => ({ addListener() {} }));
  assert.equal(typeof wrapped.WebRTCModule.addListener, "function");
});

test("Metro routes Daily/WebRTC react-native imports through the legacy shim", () => {
  const {
    isBackgroundTimerEntryPath,
    isReactNativeEntryPath,
    isWebRtcEventEmitterPath,
  } = require("../src/practice/native-shims/dailyNativeBridgeOrigin.js");

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
  assert.equal(
    isWebRtcEventEmitterPath("/app/node_modules/@daily-co/react-native-webrtc/src/EventEmitter.ts"),
    true,
  );
  assert.equal(
    isBackgroundTimerEntryPath("/app/node_modules/react-native-background-timer/index.js"),
    true,
  );
  assert.equal(
    isReactNativeEntryPath("/app/node_modules/react-native/index.js"),
    true,
  );

  const metro = readFileSync(new URL("../metro.config.js", import.meta.url), "utf8");
  assert.match(metro, /react-native-legacy-modules\.js/);
  assert.match(metro, /webrtc-EventEmitter\.js/);
  assert.match(metro, /background-timer\.js/);
  assert.match(metro, /isWebRtcEventEmitterPath/);
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
