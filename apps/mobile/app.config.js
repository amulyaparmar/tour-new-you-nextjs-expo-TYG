const fs = require("node:fs");
const path = require("node:path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
} = require("@expo/config-plugins");
const withBuildProperties = require("../../node_modules/expo-build-properties/app.plugin.js").default;

const iosGoogleServices = path.join(__dirname, "GoogleService-Info.plist");
const androidGoogleServices = path.join(__dirname, "google-services.json");
const hasIosFirebase = fs.existsSync(iosGoogleServices);
const hasAndroidFirebase = fs.existsSync(androidGoogleServices);

/**
 * Vision Camera currently brings Android Media3 1.9 through CameraX, while
 * Expo Video and Expo Audio for this SDK are compiled against Media3 1.8.
 * Resolve the shared native dependency to the Expo-compatible version so the
 * app does not crash as soon as a VideoPlayer is created on Android.
 */
function withAndroidReleaseBuildGradle(config) {
  return withAppBuildGradle(config, (androidConfig) => {
    if (androidConfig.modResults.language !== "groovy") return androidConfig;

    const legacyPackaging = "android.packagingOptions.jniLibs.useLegacyPackaging = true";
    androidConfig.modResults.contents = androidConfig.modResults.contents
      .split("\n")
      .filter((line) => line.trim() !== legacyPackaging)
      .join("\n")
      .trimEnd();
    androidConfig.modResults.contents += `\n\n${legacyPackaging}\n`;

    const marker = "// Tour Expo Media3 compatibility";
    if (androidConfig.modResults.contents.includes(marker)) return androidConfig;

    const resolution = `${marker}\nconfigurations.configureEach {\n    resolutionStrategy.eachDependency { details ->\n        if (details.requested.group == \"androidx.media3\") {\n            details.useVersion(\"1.8.0\")\n        }\n    }\n}\n\n`;
    androidConfig.modResults.contents = androidConfig.modResults.contents.replace(
      "dependencies {",
      `${resolution}dependencies {`,
    );
    return androidConfig;
  });
}

function withAndroidReleaseManifest(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) return androidConfig;

    application.$["android:allowBackup"] = "false";
    delete application.$["android:requestLegacyExternalStorage"];

    const seenServices = new Set();
    application.service = (application.service ?? []).filter((service) => {
      const name = service.$?.["android:name"];
      if (name === "com.oney.WebRTCModule.MediaProjectionService") {
        return false;
      }
      if (name === "com.daily.reactlibrary.DailyOngoingMeetingForegroundService") {
        service.$["android:foregroundServiceType"] = "microphone";
      }
      if (!name || !seenServices.has(name)) {
        if (name) seenServices.add(name);
        return true;
      }
      return false;
    });
    application.service.push({
      $: {
        "android:name": "com.oney.WebRTCModule.MediaProjectionService",
        "tools:node": "remove",
      },
    });

    const disabledAnalyticsMetadata = new Set([
      "google_analytics_adid_collection_enabled",
      "google_analytics_default_allow_ad_user_data",
      "google_analytics_default_allow_ad_personalization_signals",
    ]);
    const metadata = application["meta-data"] ?? [];
    for (const name of disabledAnalyticsMetadata) {
      const existing = metadata.find((entry) => entry.$?.["android:name"] === name);
      if (existing) {
        existing.$["android:value"] = "false";
        existing.$["tools:replace"] = "android:value";
      } else {
        metadata.push({
          $: {
            "android:name": name,
            "android:value": "false",
            "tools:replace": "android:value",
          },
        });
      }
    }
    application["meta-data"] = metadata;

    return androidConfig;
  });
}

function withAndroidReleaseGradleMemory(config) {
  return withGradleProperties(config, (androidConfig) => {
    const key = "org.gradle.jvmargs";
    const value = "-Xmx4096m -XX:MaxMetaspaceSize=1536m";
    const existing = androidConfig.modResults.find(
      (item) => item.type === "property" && item.key === key,
    );

    if (existing) {
      existing.value = value;
    } else {
      androidConfig.modResults.push({ type: "property", key, value });
    }

    return androidConfig;
  });
}

/** @type {import('expo/config').ConfigContext['config']} */
module.exports = ({ config: baseConfig }) => {
  const plugins = [
    // Manifest mods run in reverse registration order. Register cleanup first
    // so it removes legacy/duplicate entries added by third-party plugins.
    withAndroidReleaseManifest,
    withAndroidReleaseBuildGradle,
    withAndroidReleaseGradleMemory,
    ...(baseConfig.plugins ?? []),
    [
      withBuildProperties,
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: "36.0.0",
        },
        ios: {
          deploymentTarget: "16.4",
        },
      },
    ],
    [
      "expo-notifications",
      {
        color: "#087f8c",
      },
    ],
  ];

  if (hasIosFirebase || hasAndroidFirebase) {
    plugins.push("@react-native-firebase/app");
    plugins.push("@react-native-firebase/analytics");
  }

  return {
    ...baseConfig,
    ios: {
      ...baseConfig.ios,
      infoPlist: {
        ...baseConfig.ios?.infoPlist,
        UIBackgroundModes: Array.from(
          new Set([...(baseConfig.ios?.infoPlist?.UIBackgroundModes ?? []), "audio", "remote-notification"]),
        ),
      },
      ...(hasIosFirebase ? { googleServicesFile: "./GoogleService-Info.plist" } : {}),
    },
    android: {
      ...baseConfig.android,
      ...(hasAndroidFirebase ? { googleServicesFile: "./google-services.json" } : {}),
    },
    plugins,
  };
};
