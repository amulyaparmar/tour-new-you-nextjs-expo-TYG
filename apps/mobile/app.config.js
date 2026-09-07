module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICE_INFO_PLIST || "./GoogleService-Info.plist",
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
  },
});
