# Android release guide

## Release identity

- App name: `Tour`
- Package: `com.leasemagnets.tournewtouryou.tyg`
- Version: `0.1.0`
- Version code: `1` locally; EAS production builds auto-increment the remote version code
- Minimum Android: API 24
- Target/compile Android: API 36
- Build format: Android App Bundle (`.aab`)
- Production API and website: `https://tour.you`
- Privacy policy: `https://tour.you/privacy-policy`

## Production build

Production builds use EAS-managed signing. Log into an Expo account with access to
the `tourtyg` project before running:

```bash
cd /Users/joseph/Projects/tour-new-nextjs-expo-TYG/apps/mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile production
```

The current local Expo login (`ng-joseph`) cannot access project
`a30cd0f8-93f0-423b-979b-2c415aa6a5c4`. Sign in as the project owner or invite
that account before starting the store build. Do not replace an existing upload
key when the app already exists in Play Console.

Required EAS production environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL=https://tour.you`
- `EXPO_PUBLIC_SITE_URL=https://tour.you`

After the first release has been created in Play Console, submit a completed EAS
build to the internal track with:

```bash
cd /Users/joseph/Projects/tour-new-nextjs-expo-TYG/apps/mobile
npx eas-cli@latest submit --platform android --profile production
```

## Play Console setup

1. Create the app as an app, not a game; select free and the appropriate business category.
2. Enable Play App Signing and upload the EAS production `.aab` to Internal testing first.
3. Use `store-assets/store-ready-v4/google/feature-graphic.png` as the feature graphic.
4. Upload the seven images in `store-assets/store-ready-v4/google/phone-screenshots/` in filename order.
5. Set the privacy policy URL to `https://tour.you/privacy-policy`.
6. Set Ads to `No`. The Android build removes Advertising ID permissions.
7. Complete App access with a stable reviewer account and exact OTP sign-in instructions. The reviewer must be able to reach sessions, recording, analysis, practice, and AI chat.
8. Complete Content rating and set the target audience to adults/working professionals, not children.
9. Complete the Data safety form from the checklist below and verify it against production vendors and retention rules.
10. Declare the microphone and media-playback foreground service use cases. Supply a short reviewer video showing an agent starting a tour recording and playing session audio.
11. Confirm the mobile app is invite/workspace access only and does not create accounts. If account creation is later added inside the app, add both in-app account deletion and a public deletion-request URL before release.
12. Run Internal testing on physical Android hardware before promoting to Closed or Production.

## Data safety review

Tour handles the following data for app functionality and account management.
Confirm every answer against the production configuration before submitting:

- Personal info: name, work email, user ID, and optional profile/contact details.
- Audio: tour recordings and live transcription audio.
- Photos/videos: property assets and videos the user explicitly records or selects.
- App activity/content: transcripts, AI chat, coaching, comments, practice results, and session metadata.
- Diagnostics/device identifiers: only if Firebase Analytics or another production diagnostics provider is enabled.

Declare data as encrypted in transit. Do not mark data as sold. Whether processor
transfers count as sharing depends on the production contracts and Google Play's
service-provider exceptions; this must be confirmed by the business owner.

## Foreground service explanations

- Microphone: keeps an explicitly started tour recording and live transcription active when the app is backgrounded.
- Media playback: continues user-initiated session audio playback when the app is backgrounded.

The app displays recording controls and notifications for active background work.
Do not describe these services as starting automatically.

## Release checks

Run these before every store build:

```bash
cd /Users/joseph/Projects/tour-new-nextjs-expo-TYG/apps/mobile
npm install
npm run typecheck
npx expo-doctor
npx eas-cli@latest config --platform android --profile production
```

Then verify on a physical device:

- OTP sign-in and property selection
- start/pause/resume/stop recording and the 3-2-1 countdown
- live transcription and background recording notification
- audio playback and dynamic waveform
- session upload, analysis, transcript, AI chat, and practice sessions
- camera recording, asset upload, and Save to Photos
- notification, microphone, camera, and speech permission denial/recovery
- airplane-mode and slow-network states
- sign out and relaunch

## Release notes

- Record and transcribe tours live.
- Review transcripts, scores, coaching, and audio insights.
- Ask Tour AI questions during and after a tour.
- Practice tour conversations with AI roleplay.
- Capture and manage property assets.
- Improved mobile navigation, performance, and reliability.
