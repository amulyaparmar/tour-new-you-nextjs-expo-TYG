const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const workletsRoot = path.resolve(projectRoot, "node_modules/react-native-worklets");

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
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
