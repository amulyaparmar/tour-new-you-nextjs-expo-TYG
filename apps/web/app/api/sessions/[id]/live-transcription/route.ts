import { NextResponse } from "next/server";

import { AdminAuthError } from "@/lib/admin-auth";
import { createLiveTranscriptionToken } from "@/lib/live-transcription-token";
import { requireSessionWriteAccess } from "@/lib/session-access";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;

  try {
    await requireSessionWriteAccess(request, id);

    const proxyUrl = process.env.MUSE_REALTIME_WS_URL?.trim();
    const secret = process.env.MUSE_PROXY_TOKEN_SECRET?.trim();
    if (!proxyUrl || !secret) {
      return NextResponse.json({ error: "Live transcription is unavailable." }, { status: 503 });
    }

    const url = new URL(proxyUrl);
    if (url.protocol !== "wss:" && !(process.env.NODE_ENV !== "production" && url.protocol === "ws:")) {
      throw new Error("MUSE_REALTIME_WS_URL must use WebSocket Secure (wss://).");
    }

    const { token, expiresAt } = createLiveTranscriptionToken(id, secret);
    url.searchParams.set("token", token);

    return NextResponse.json(
      { url: url.toString(), expiresAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Live transcription is unavailable." },
      { status }
    );
  }
}
