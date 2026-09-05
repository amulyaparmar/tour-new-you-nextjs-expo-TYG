import "server-only";

import { createHmac } from "node:crypto";

const TOKEN_TTL_SECONDS = 90;

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createLiveTranscriptionToken(sessionId: string, secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = encodeBase64Url(JSON.stringify({ sessionId, exp: expiresAt }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: `${payload}.${signature}`, expiresAt };
}
