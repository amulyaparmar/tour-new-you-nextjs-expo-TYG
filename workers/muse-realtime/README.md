# Muse realtime proxy

This Worker authenticates a short-lived session token from the Tour API and
proxies raw PCM audio to Muse Voice Transcribe. The Meta model key stays on the
Worker and is never shipped in the mobile bundle.

Set the same `MUSE_PROXY_TOKEN_SECRET` in the Worker and web app. Set
`META_MODEL_API_KEY` only in the Worker, then set the deployed Worker WebSocket
URL as `MUSE_REALTIME_WS_URL` in the web app.

```bash
npx wrangler secret put META_MODEL_API_KEY --config workers/muse-realtime/wrangler.jsonc
npx wrangler secret put MUSE_PROXY_TOKEN_SECRET --config workers/muse-realtime/wrangler.jsonc
npx wrangler deploy --config workers/muse-realtime/wrangler.jsonc
```
