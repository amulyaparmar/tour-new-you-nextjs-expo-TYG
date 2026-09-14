import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appConfig = JSON.parse(
  readFileSync(new URL("../app.json", import.meta.url), "utf8"),
).expo;
const manifest = readFileSync(
  new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
  "utf8",
);
const buildGradle = readFileSync(
  new URL("../android/app/build.gradle", import.meta.url),
  "utf8",
);
const mainApplication = readFileSync(
  new URL(
    "../android/app/src/main/java/com/leasemagnets/tournewtouryou/tyg/MainApplication.kt",
    import.meta.url,
  ),
  "utf8",
);

const blockedPermissions = new Set(appConfig.android.blockedPermissions);

test("release config blocks capture and broad media permissions", () => {
  for (const permission of [
    "android.permission.ACTIVITY_RECOGNITION",
    "android.permission.CAMERA",
    "android.permission.FOREGROUND_SERVICE_CAMERA",
    "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
    "android.permission.HIGH_SAMPLING_RATE_SENSORS",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  ]) {
    assert.equal(blockedPermissions.has(permission), true, permission);
  }
  assert.deepEqual(appConfig.android.permissions, ["android.permission.RECORD_AUDIO"]);
});

test("native manifest keeps microphone services and removes capture services", () => {
  assert.match(manifest, /FOREGROUND_SERVICE_MICROPHONE/);
  assert.match(manifest, /AudioRecordingService/);
  assert.match(
    manifest,
    /DailyOngoingMeetingForegroundService[^>]+foregroundServiceType="microphone"/,
  );
  assert.match(manifest, /CAMERA" tools:node="remove"/);
  assert.match(manifest, /MediaProjectionService" tools:node="remove"/);
  assert.match(manifest, /AudioControlsService" tools:node="remove"/);
});

test("Expo 57 release bootstrap uses the packaged Hermes compiler and host factory", () => {
  assert.match(buildGradle, /require\.resolve\('hermes-compiler\/package\.json'/);
  assert.match(mainApplication, /ExpoReactHostFactory\.getDefaultReactHost/);
  assert.match(mainApplication, /jsMainModulePath = "\.expo\/\.virtual-metro-entry"/);
});
