const appJson = require("./app.json");

const plugins = [
  ...(appJson.expo.plugins ?? []),
  [
    "expo-notifications",
    {
      color: "#087f8c",
    },
  ],
];

/** @type {import('expo/config').ExpoConfig} */
const config = {
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    infoPlist: {
      ...appJson.expo.ios?.infoPlist,
      UIBackgroundModes: Array.from(
        new Set([...(appJson.expo.ios?.infoPlist?.UIBackgroundModes ?? []), "audio", "remote-notification"]),
      ),
    },
  },
  android: {
    ...appJson.expo.android,
  },
  plugins,
};

module.exports = { expo: config };
