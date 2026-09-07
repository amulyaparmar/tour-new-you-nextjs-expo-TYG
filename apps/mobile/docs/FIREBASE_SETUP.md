# Firebase setup (push + analytics + crash reporting)

Firebase is not committed. Create a project, then drop the config files into `apps/mobile/`.

## 1. Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → Add project.
2. Enable **Google Analytics** when prompted.
3. Enable **Crashlytics**.
4. Enable **Cloud Messaging**.

## 2. Register apps

- **iOS**: bundle id `com.leasemagnets.tournewtouryou.tyg`
  - Download `GoogleService-Info.plist` → save as `apps/mobile/GoogleService-Info.plist`
- **Android**: package `com.leasemagnets.tournewtouryou.tyg`
  - Download `google-services.json` → save as `apps/mobile/google-services.json`

## 3. EAS credentials

From `apps/mobile`:

```bash
eas credentials
```

- Upload **FCM** server key / Google service account for Android push
- Upload **APNs** key for iOS push (Expo Notifications)

Add the two ignored Firebase files to the EAS `preview` and `production`
environments as file variables:

- `GOOGLE_SERVICE_INFO_PLIST` from `GoogleService-Info.plist`
- `GOOGLE_SERVICES_JSON` from `google-services.json`

The dynamic app config uses the EAS-provided file paths in cloud builds and the
local files during local builds. The EAS post-install hook copies them into the
checked-in native projects without committing the Firebase files.

The iOS app uses Firebase through CocoaPods with static frameworks. Firebase
SPM is disabled to remain compatible with the app's existing native modules.

## 4. Rebuild native app

```bash
cd apps/mobile
npx expo prebuild --clean   # if needed
npx expo run:ios
# or
eas build --profile development
```

When opening Xcode or Android Studio directly, run `npm run
sync:firebase-config` from `apps/mobile` first.

OTA updates cannot add native Firebase, Crashlytics, or notification modules —
a new binary is required after this setup.

## Analytics in DebugView

Native debug builds (`expo run:ios`) collect analytics. Events appear in
Firebase **DebugView** after enabling debug mode once. Realtime Console reports
can lag, so use DebugView for immediate confirmation.

## Verify Crashlytics

Crash reporting is disabled in development builds. Verify with a release build,
trigger one intentional test crash, reopen the app, and confirm it appears in
the Firebase Crashlytics dashboard. Remove the test crash before distribution.

## Related env (web)

Set on Vercel for crons:

```
CRON_SECRET=<random-secret>
```

- `GET /api/cron/entrata-sync` — every 12 hours  
- `GET /api/cron/session-reminders` — every 15 minutes  

Both expect `Authorization: Bearer $CRON_SECRET`.

Apply the session reminder migration (`reminder_sent_at`) before relying on tour reminders.
