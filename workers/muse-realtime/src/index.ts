type Env = {
  META_MODEL_API_KEY: string;
  MUSE_PROXY_TOKEN_SECRET: string;
};

type TokenPayload = {
  sessionId: string;
  exp: number;
};

const META_REALTIME_URL = "wss://api.meta.ai/v1/asr/realtime";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ ok: true, service: "tour-muse-realtime" });
    }

    const token = new URL(request.url).searchParams.get("token");
    const payload = token
      ? await verifyToken(token, env.MUSE_PROXY_TOKEN_SECRET).catch(() => null)
      : null;
    if (!payload) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!env.META_MODEL_API_KEY) {
      return new Response("Unavailable", { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const upstreamUrl = new URL(META_REALTIME_URL);
    upstreamUrl.searchParams.set("sessionId", crypto.randomUUID());
    const upstream = new WebSocket(upstreamUrl.toString());
    let upstreamOpen = false;
    const pending: Array<string | ArrayBuffer> = [];

    upstream.addEventListener("open", () => {
      upstreamOpen = true;
      upstream.send(JSON.stringify({
        model: "muse-voice-transcribe-1.0",
        mode: "DIARIZATION",
        audioEncoding: "PCM_16KHZ",
        partialMode: "CUMULATIVE",
        emitAudioProgress: true,
        languageBias: ["English"],
        authorization: { accessToken: `Bearer ${env.META_MODEL_API_KEY}` },
      }));
      for (const message of pending.splice(0)) upstream.send(message);
    });

    upstream.addEventListener("message", (event) => {
      try {
        server.send(event.data);
      } catch {
        upstream.close(1000, "Client disconnected");
      }
    });
    upstream.addEventListener("close", (event) => {
      try {
        server.close(validCloseCode(event.code) ? event.code : 1011, event.reason.slice(0, 120));
      } catch {
        // The client may already be closed.
      }
    });
    upstream.addEventListener("error", () => {
      try {
        server.close(1011, "Upstream unavailable");
      } catch {
        // The client may already be closed.
      }
    });

    server.addEventListener("message", (event: MessageEvent<string | ArrayBuffer>) => {
      const message = typeof event.data === "string" ? event.data : event.data as ArrayBuffer;
      if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
        upstream.send(message);
      } else if (pending.length < 60) {
        pending.push(message);
      }
    });
    server.addEventListener("close", () => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
        upstream.close(1000, "Client disconnected");
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  },
};

async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  if (!secret) return null;
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signaturePart),
    new TextEncoder().encode(payloadPart)
  );
  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart))) as TokenPayload;
  if (!payload.sessionId || !Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validCloseCode(code: number) {
  return code === 1000 || (code >= 3000 && code <= 4999);
}
