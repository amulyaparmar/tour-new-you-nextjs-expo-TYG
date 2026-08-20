import "server-only";

import twilio from "twilio";

export const DEFAULT_TWILIO_VOICE_FROM = "+14157352992";

/**
 * Normalize a raw phone string to E.164. Mirrors the helper in tour.video.
 * Returns null when the input has no usable digits.
 */
export function normalizePhoneE164(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) {
    const normalized = `+${digits.slice(1).replace(/\D/g, "")}`;
    return normalized.length > 1 ? normalized : null;
  }

  const onlyDigits = digits.replace(/\D/g, "");
  if (!onlyDigits) return null;
  if (onlyDigits.length === 10) return `+1${onlyDigits}`;
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1")) return `+${onlyDigits}`;
  return `+${onlyDigits}`;
}

type TwilioSmsConfig = {
  accountSid: string;
  authToken: string;
  from: string;
};

function getTwilioVoiceConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_VOICE_FROM ||
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER ||
    process.env.TWILIO_SMS_FROM ||
    DEFAULT_TWILIO_VOICE_FROM;
  const apiKey = process.env.TWILIO_VOICE_API_KEY;
  const apiSecret = process.env.TWILIO_VOICE_API_SECRET;
  const twimlAppSid = process.env.TWILIO_VOICE_TWIML_APP_SID;
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from, apiKey, apiSecret, twimlAppSid };
}

export function getTwilioVoiceTokenConfig() {
  const config = getTwilioVoiceConfig();
  if (!config?.apiKey || !config.apiSecret || !config.twimlAppSid) return null;
  return config;
}

export function getTwilioVoiceCallerId() {
  return getTwilioVoiceConfig()?.from ?? DEFAULT_TWILIO_VOICE_FROM;
}

export function validateTwilioVoiceWebhook(
  request: Request,
  payload: Record<string, string>,
): boolean {
  const config = getTwilioVoiceConfig();
  if (!config?.authToken) return false;
  if (process.env.NODE_ENV !== "production" && process.env.TWILIO_VALIDATE_SIGNATURE !== "true") {
    return true;
  }
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;
  return twilio.validateRequest(config.authToken, signature, request.url, payload);
}

/**
 * Reads Twilio SMS config from the environment. Unlike the reference repo, there
 * are NO hardcoded credentials — config is env-driven only.
 */
function getTwilioSmsConfig(): TwilioSmsConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_SMS_FROM ||
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return null;
  }

  return { accountSid, authToken, from };
}

export class TwilioConfigError extends Error {
  constructor() {
    super(
      "Missing Twilio SMS config. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_SMS_FROM."
    );
    this.name = "TwilioConfigError";
  }
}

export type SendSmsInput = {
  to: string;
  body: string;
  /** Optional MMS media URLs (https only). */
  mediaUrl?: string[];
};

export type SendSmsResult = {
  sid: string;
  status: string;
  to: string;
  from: string;
};

/**
 * Sends an SMS/MMS via Twilio. Throws TwilioConfigError when env is unset, or a
 * generic Error on invalid recipient / Twilio API failure. Callers that must not
 * fail the surrounding request should catch.
 */
export async function sendSms({ to, body, mediaUrl }: SendSmsInput): Promise<SendSmsResult> {
  const config = getTwilioSmsConfig();
  if (!config) {
    throw new TwilioConfigError();
  }

  const normalizedTo = normalizePhoneE164(to);
  if (!normalizedTo) {
    throw new Error("Invalid recipient phone number.");
  }

  const media = (mediaUrl ?? []).filter((url) => /^https:\/\//i.test(url));

  const client = twilio(config.accountSid, config.authToken);
  const message = await client.messages.create({
    from: config.from,
    to: normalizedTo,
    body,
    ...(media.length ? { mediaUrl: media } : {})
  });

  return {
    sid: message.sid,
    status: message.status,
    to: normalizedTo,
    from: config.from
  };
}
