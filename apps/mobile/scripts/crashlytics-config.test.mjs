import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appConfig = JSON.parse(
  readFileSync(new URL("../app.json", import.meta.url), "utf8"),
).expo;
const firebaseConfig = JSON.parse(
  readFileSync(new URL("../firebase.json", import.meta.url), "utf8"),
)["react-native"];
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const dynamicConfig = readFileSync(
  new URL("../app.config.js", import.meta.url),
  "utf8",
);
const androidRootBuild = readFileSync(
  new URL("../android/build.gradle", import.meta.url),
  "utf8",
);
const androidAppBuild = readFileSync(
  new URL("../android/app/build.gradle", import.meta.url),
  "utf8",
);
const appDelegate = readFileSync(
  new URL("../ios/Tour/AppDelegate.swift", import.meta.url),
  "utf8",
);
const xcodeProject = readFileSync(
  new URL("../ios/Tour.xcodeproj/project.pbxproj", import.meta.url),
  "utf8",
);
const syncScript = readFileSync(
  new URL("./sync-firebase-config.mjs", import.meta.url),
  "utf8",
);
const podfile = readFileSync(new URL("../ios/Podfile", import.meta.url), "utf8");

test("Crashlytics native modules and config plugins are installed", () => {
  assert.ok(packageJson.dependencies["@react-native-firebase/app"]);
  assert.ok(packageJson.dependencies["@react-native-firebase/crashlytics"]);
  const firebaseAppPlugin = appConfig.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@react-native-firebase/app",
  );
  assert.equal(firebaseAppPlugin[1].ios.disableSPM, true);
  assert.ok(appConfig.plugins.includes("@react-native-firebase/crashlytics"));
  assert.match(podfile, /\$RNFirebaseDisableSPM = true/);
  assert.match(podfile, /\$RNFirebaseAsStaticFramework = true/);

  const buildProperties = appConfig.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  );
  assert.equal(buildProperties[1].ios.useFrameworks, "static");
});

test("Firebase service files support local and EAS builds", () => {
  assert.equal(appConfig.ios.googleServicesFile, "./GoogleService-Info.plist");
  assert.equal(appConfig.android.googleServicesFile, "./google-services.json");
  assert.match(dynamicConfig, /GOOGLE_SERVICE_INFO_PLIST/);
  assert.match(dynamicConfig, /GOOGLE_SERVICES_JSON/);
  assert.match(packageJson.scripts["eas-build-post-install"], /firebase-config/);
  assert.match(xcodeProject, /GoogleService-Info\.plist in Resources/);
  assert.match(syncScript, /"ios", "GoogleService-Info\.plist"/);
  assert.match(syncScript, /"ios", "Tour", "GoogleService-Info\.plist"/);
});

test("checked-in native projects initialize Firebase and upload crashes", () => {
  assert.match(appDelegate, /FirebaseApp\.configure\(\)/);
  assert.match(androidRootBuild, /firebase-crashlytics-gradle/);
  assert.match(androidRootBuild, /google-services/);
  assert.match(androidAppBuild, /com\.google\.firebase\.crashlytics/);
  assert.match(androidAppBuild, /com\.google\.gms\.google-services/);
});

test("release crash collection avoids duplicate JavaScript reports", () => {
  assert.equal(firebaseConfig.crashlytics_auto_collection_enabled, true);
  assert.equal(firebaseConfig.crashlytics_debug_enabled, false);
  assert.equal(
    firebaseConfig.crashlytics_javascript_exception_handler_chaining_enabled,
    false,
  );
});
