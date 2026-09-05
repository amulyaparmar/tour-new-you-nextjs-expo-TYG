"use strict";

function isDailyNativeBridgeOrigin(originModulePath) {
  if (!originModulePath) return false;
  const normalized = String(originModulePath).replace(/\\/g, "/");
  return (
    normalized.includes("/@daily-co/react-native-webrtc/") ||
    normalized.includes("/@daily-co/react-native-daily-js/") ||
    normalized.includes("/react-native-background-timer/")
  );
}

module.exports = { isDailyNativeBridgeOrigin };
