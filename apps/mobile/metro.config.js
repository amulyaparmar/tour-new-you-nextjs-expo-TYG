const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const workletsRoot = path.resolve(projectRoot, "node_modules/react-native-worklets");
const {
  isBackgroundTimerEntryPath,
  isDailyNativeBridgeOrigin,
  isNativeShimPath,
  isReactNativeEntryPath,
  isWebRtcEventEmitterPath,
} = require("./src/practice/native-shims/dailyNativeBridgeOrigin");

const legacyNativeModulesShim = path.resolve(
  projectRoot,
  "src/practice/native-shims/react-native-legacy-modules.js",
);
const webrtcEventEmitterShim = path.resolve(
  projectRoot,
  "src/practice/native-shims/webrtc-EventEmitter.js",
);
const backgroundTimerShim = path.resolve(
  projectRoot,
  "src/practice/native-shims/background-timer.js",
);

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.alias = {
  ...(config.resolver.alias ?? {}),
  "@": path.resolve(projectRoot, "src"),
};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  // Keep Metro on the app's SDK 57-compatible Worklets runtime.
  "react-native-worklets": workletsRoot,
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-worklets" || moduleName.startsWith("react-native-worklets/")) {
    return {
      type: "sourceFile",
      filePath: require.resolve(
        moduleName === "react-native-worklets" ? "react-native-worklets" : moduleName,
        { paths: [workletsRoot, projectRoot] }
      ),
    };
  }

  const origin = context.originModulePath;
  if (moduleName === "react-native" && isDailyNativeBridgeOrigin(origin) && !isNativeShimPath(origin)) {
    return { type: "sourceFile", filePath: legacyNativeModulesShim };
  }

  const resolved = upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);

  if (resolved?.type !== "sourceFile" || !resolved.filePath || isNativeShimPath(origin)) {
    return resolved;
  }

  // Daily/WebRTC construct NativeEventEmitter(NativeModules.*) at import time.
  // On RN New Architecture those RCT modules are null until looked up by name
  // through TurboModuleRegistry / the bridgeless interop proxy.
  if (isDailyNativeBridgeOrigin(origin) && isReactNativeEntryPath(resolved.filePath)) {
    return { type: "sourceFile", filePath: legacyNativeModulesShim };
  }
  if (isWebRtcEventEmitterPath(resolved.filePath)) {
    return { type: "sourceFile", filePath: webrtcEventEmitterShim };
  }
  if (isBackgroundTimerEntryPath(resolved.filePath) && moduleName === "react-native-background-timer") {
    return { type: "sourceFile", filePath: backgroundTimerShim };
  }

  return resolved;
};

module.exports = config;
