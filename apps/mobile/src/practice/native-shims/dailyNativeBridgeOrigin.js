"use strict";

const path = require("path");

function normalizePath(filePath) {
  return String(filePath ?? "").replace(/\\/g, "/");
}

function isDailyNativeBridgeOrigin(originModulePath) {
  const normalized = normalizePath(originModulePath);
  if (!normalized) return false;
  return (
    normalized.includes("/@daily-co/react-native-webrtc/") ||
    normalized.includes("/@daily-co/react-native-daily-js/") ||
    normalized.includes("/react-native-background-timer/")
  );
}

function isReactNativeEntryPath(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes("/react-native/index.js") ||
    normalized.includes("/react-native/index.ts") ||
    /\/react-native\/src\/index\.(js|ts|tsx)$/.test(normalized)
  );
}

function isWebRtcEventEmitterPath(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes("/@daily-co/react-native-webrtc/") &&
    /\/EventEmitter\.(ts|js)$/.test(normalized)
  );
}

function isBackgroundTimerEntryPath(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes("/react-native-background-timer/") &&
    /\/index\.(js|ts)$/.test(normalized)
  );
}

function isNativeShimPath(filePath) {
  return normalizePath(filePath).includes("/src/practice/native-shims/");
}

module.exports = {
  isBackgroundTimerEntryPath,
  isDailyNativeBridgeOrigin,
  isNativeShimPath,
  isReactNativeEntryPath,
  isWebRtcEventEmitterPath,
  nativeShimDirectory: path.join(__dirname),
};
