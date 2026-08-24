import "server-only";

import {
  createHmac,
  randomInt,
  randomUUID,
} from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_TABLE = "admin_otp_challenges";

export function appReviewOtpConfig() {
  const email = process.env.TOUR_APP_REVIEW_EMAIL?.trim().toLowerCase() ?? "";
  const code = process.env.TOUR_APP_REVIEW_OTP?.trim() ?? "";
  return email && /^\d{6}$/.test(code) ? { email, code } : null;
}

type StoredOtpChallenge = {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  used_at: string | null;
  created_at: string;
  request_fingerprint: string | null;
};

type OtpDatabase = {
  public: {
    Tables: {
      admin_otp_challenges: {
        Row: StoredOtpChallenge;
        Insert: {
          id?: string;
          email: string;
          code_hash: string;
          expires_at: string;
          attempts?: number;
          used_at?: string | null;
          created_at?: string;
          request_fingerprint?: string | null;
        };
        Update: Partial<StoredOtpChallenge>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_admin_otp_challenge: {
        Args: {
          p_challenge_id: string;
          p_email: string;
          p_code_hash: string;
        };
        Returns: string;
      };
      issue_admin_otp_challenge: {
        Args: {
          p_challenge_id: string;
          p_email: string;
          p_code_hash: string;
          p_expires_at: string;
          p_request_fingerprint: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export class AdminOtpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: "cooldown" | "rate_email" | "rate_fingerprint"
  ) {
    super(message);
    this.name = "AdminOtpError";
  }
}

export function createAdminOtpCode() {
  return String(randomInt(100_000, 1_000_000));
}

export function adminOtpRequestFingerprint(request: Request) {
  const forwarded = (
    request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-forwarded-for")
    || request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || ""
  )
    .split(",")[0]
    ?.trim();
  if (!forwarded) return null;
  return createHmac("sha256", otpSigningSecret())
    .update(`otp-request\n${forwarded}`)
    .digest("hex");
}

export async function createAdminOtpChallenge(
  email: string,
  code: string,
  requestFingerprint: string | null = null
) {
  const service = otpServiceClient();
  const now = Date.now();
  const challengeId = randomUUID();
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
  const { data: issueStatus, error: issueError } = await service.rpc(
    "issue_admin_otp_challenge",
    {
      p_challenge_id: challengeId,
      p_email: email,
      p_code_hash: hashOtp(challengeId, email, code),
      p_expires_at: expiresAt,
      p_request_fingerprint: requestFingerprint,
    }
  );

  if (issueError) {
    throw new Error(`Could not create the sign-in challenge: ${issueError.message}`);
  }
  if (issueStatus === "rate_email") {
    throw new AdminOtpError(
      "Too many codes were requested for this email. Try again in 15 minutes.",
      429,
      "rate_email"
    );
  }
  if (issueStatus === "rate_fingerprint") {
    throw new AdminOtpError(
      "Too many sign-in codes were requested. Try again in 15 minutes.",
      429,
      "rate_fingerprint"
    );
  }
  if (issueStatus === "cooldown") {
    throw new AdminOtpError(
      "A code was just sent. Wait a moment before requesting another.",
      429,
      "cooldown"
    );
  }
  if (issueStatus !== "issued") {
    throw new Error(`Unexpected sign-in challenge status: ${String(issueStatus)}`);
  }

  // A failed cleanup is harmless because expired challenges cannot verify.
  await service
    .from(OTP_TABLE)
    .delete()
    .lt("expires_at", new Date(now - 24 * 60 * 60 * 1000).toISOString());

  return { challengeId, expiresAt };
}

export async function getActiveAdminOtpChallenge(email: string) {
  const { data, error } = await otpServiceClient()
    .from(OTP_TABLE)
    .select("id, expires_at")
    .eq("email", email)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the active sign-in challenge: ${error.message}`);
  }
  return data;
}

export async function invalidateAdminOtpChallenge(challengeId: string, email: string) {
  const { error } = await otpServiceClient()
    .from(OTP_TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq("id", challengeId)
    .eq("email", email)
    .is("used_at", null);

  if (error) {
    throw new Error(`Could not invalidate the sign-in challenge: ${error.message}`);
  }
}

export async function restoreAdminOtpChallenge(challengeId: string, email: string) {
  const { error } = await otpServiceClient()
    .from(OTP_TABLE)
    .update({ used_at: null })
    .eq("id", challengeId)
    .eq("email", email)
    .lt("attempts", 5)
    .gt("expires_at", new Date().toISOString())
    .not("used_at", "is", null);

  if (error) {
    throw new Error(`Could not restore the sign-in challenge: ${error.message}`);
  }
}

export async function consumeAdminOtpChallenge(input: {
  challengeId: string;
  email: string;
  code: string;
}) {
  const service = otpServiceClient();
  const { data, error } = await service.rpc("consume_admin_otp_challenge", {
    p_challenge_id: input.challengeId,
    p_email: input.email,
    p_code_hash: hashOtp(input.challengeId, input.email, input.code),
  });

  if (error) {
    throw new Error(`Could not verify the sign-in challenge: ${error.message}`);
  }
  if (data === "valid") return;
  if (data === "expired") {
    throw new AdminOtpError(
      "That code has expired. Request a new sign-in code.",
      400
    );
  }
  throw invalidCodeError();
}

function otpServiceClient() {
  return getSupabaseServiceClient() as unknown as SupabaseClient<OtpDatabase>;
}

function hashOtp(challengeId: string, email: string, code: string) {
  return createHmac("sha256", otpSigningSecret())
    .update(`${challengeId}\n${email}\n${code}`)
    .digest("hex");
}

function otpSigningSecret() {
  const secret =
    process.env.TOUR_OTP_SIGNING_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Missing TOUR_OTP_SIGNING_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return secret;
}

function invalidCodeError() {
  return new AdminOtpError(
    "That code is not valid. Check the email and try again.",
    400
  );
}
