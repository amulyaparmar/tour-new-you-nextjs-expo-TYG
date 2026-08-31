# Tour Google Play upload pack

Generated assets:

- `app-icon.png` — 512 x 512 PNG
- `feature-graphic.png` — 1024 x 500 PNG
- `phone-screenshots/` — seven 1440 x 2880 JPEG screenshots

Regenerate the images from the repository root:

```bash
node apps/mobile/store-assets/generate-store-ready-v4.mjs
node apps/mobile/store-assets/generate-play-console-pack.mjs
```

## Store listing

**App name**

Tour: AI Leasing Coach

**Short description**

Record tours, get coaching, and practice stronger leasing conversations.

**Full description**

Tour helps leasing professionals run stronger property tours and turn every conversation into a better next one.

Capture a live tour, review the conversation, and see the moments that shaped the outcome. Tour brings together recordings, transcripts, coaching, and property context so agents can stay prepared, improve their delivery, and follow up with clarity.

With Tour, teams can:

- Record and transcribe live leasing tours.
- Review tour scores, coaching actions, and audio insights.
- Ask Tour AI for property-aware help during and after a tour.
- Practice real leasing conversations with an AI prospect.
- Keep tour history, property assets, and follow-up context in one place.

Tour is built for leasing teams who want to prepare with confidence, improve every tour, and convert more conversations into great outcomes.

**Category**

Business

**Contact details**

- Website: `https://tour.you`
- Privacy policy: `https://tour.you/privacy-policy`
- Support email: add the monitored support address shown to customers.

## App content answers to prepare

These are the expected answers based on the current app. Confirm them against the production backend, vendors, and legal policy before submitting.

- Ads: No.
- App access: restricted. Add a stable reviewer account, OTP instructions, and the property to select after sign-in.
- Target audience: adults and working professionals; not designed for children.
- Data safety: declare account/profile details, audio recordings, selected or recorded photos/videos, transcripts, AI chat, coaching, practice results, session metadata, and any production analytics or diagnostics SDK data.
- Security: data is encrypted in transit; do not state that data is sold.
- Permissions: microphone for a user-started tour recording and live transcription; camera and media only when a user records or selects a property asset; notifications for recording and session updates.
- Foreground service: microphone for a user-started recording; media playback for user-started session audio playback. Supply a short unlisted reviewer video demonstrating both flows if Play Console asks.

## Release notes

- Record and transcribe tours live.
- Review transcripts, scores, coaching, and audio insights.
- Ask Tour AI for help during and after a tour.
- Practice leasing conversations with AI roleplay.
- Capture and manage property assets.
