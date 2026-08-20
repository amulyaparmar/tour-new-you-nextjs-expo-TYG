import { NextResponse } from "next/server";
import { jwt } from "twilio";

import { getTwilioVoiceTokenConfig } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getTwilioVoiceTokenConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Twilio Voice is not configured. Set the Voice API key, secret, and TwiML App SID." },
      { status: 503 },
    );
  }

  const identity = `phone-shop-${crypto.randomUUID()}`;
  const token = new jwt.AccessToken(config.accountSid, config.apiKey!, config.apiSecret!, {
    ttl: 60 * 60,
    identity,
  });
  token.addGrant(new jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: config.twimlAppSid!,
    incomingAllow: false,
    outgoingApplicationParams: { callerId: config.from },
  }));

  return NextResponse.json({ token: token.toJwt(), identity, callerId: config.from });
}
