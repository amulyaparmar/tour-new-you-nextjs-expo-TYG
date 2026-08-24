import { NextResponse } from "next/server";

import {
  AdminOtpError,
  adminOtpRequestFingerprint,
  createAdminOtpChallenge,
  createAdminOtpCode,
  getActiveAdminOtpChallenge,
  invalidateAdminOtpChallenge,
} from "@/lib/admin-otp";
import { sendTransactionalEmail } from "@/lib/transactional-email";

const PERSONAL_EMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const emailParts = email.split("@");
  const domain = emailParts.length === 2 ? emailParts[1] : "";

  if (!emailParts[0] || !domain || /\s/.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email address." }, { status: 400 });
  }
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return NextResponse.json(
      { error: "Use the work email connected to your Tour account." },
      { status: 400 }
    );
  }

  let issuedChallengeId = "";
  try {
    const challengeCode = createAdminOtpCode();
    const challenge = await createAdminOtpChallenge(
      email,
      challengeCode,
      adminOtpRequestFingerprint(request)
    );
    issuedChallengeId = challenge.challengeId;
    const displayName = email
      .split("@")[0]
      ?.split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Tour user";
    const delivery = await sendTransactionalEmail({
      to: [email],
      subject: `${challengeCode} is your Tour sign-in code`,
      text: [
        `Hi ${displayName},`,
        "",
        `Your Tour sign-in code is ${challengeCode}.`,
        "",
        "It expires in 10 minutes. If you did not request this code, you can ignore this email.",
      ].join("\n"),
      html: [
        `<p>Hi ${escapeHtml(displayName)},</p>`,
        "<p>Your Tour sign-in code is:</p>",
        `<p style="font-size:30px;font-weight:700;letter-spacing:6px">${challengeCode}</p>`,
        "<p>It expires in 10 minutes. If you did not request this code, you can ignore this email.</p>",
      ].join(""),
    });
    if (!delivery.configured || delivery.delivered < 1) {
      if (canUseLocalOtpFallback()) {
        console.info(
          [
            "",
            "Tour local sign-in code",
            `Email: ${email}`,
            `Code: ${challengeCode}`,
            `Expires: ${challenge.expiresAt}`,
            "",
          ].join("\n")
        );
        return NextResponse.json({
          sent: true,
          email,
          challengeId: challenge.challengeId,
          expiresAt: challenge.expiresAt,
          delivery: "local-terminal",
        });
      }
      await invalidateAdminOtpChallenge(challenge.challengeId, email);
      return NextResponse.json(
        { error: "Could not send a sign-in code." },
        { status: 503 }
      );
    }
    return NextResponse.json({
      sent: true,
      email,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
    });
  } catch (caught) {
    if (issuedChallengeId) {
      await invalidateAdminOtpChallenge(issuedChallengeId, email).catch(() => undefined);
    }
    const status = caught instanceof AdminOtpError ? caught.status : 500;
    if (caught instanceof AdminOtpError && caught.code === "cooldown") {
      const activeChallenge = await getActiveAdminOtpChallenge(email).catch(() => null);
      if (activeChallenge) {
        return NextResponse.json(
          {
            error: caught.message,
            challengeId: activeChallenge.id,
            expiresAt: activeChallenge.expires_at,
          },
          { status }
        );
      }
    }
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Could not send a sign-in code." },
      { status }
    );
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function canUseLocalOtpFallback() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.TOUR_DISABLE_LOCAL_OTP_FALLBACK !== "true"
  );
}
