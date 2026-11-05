import { messages } from "@/domain/messages";
import { normalizeOtpCode } from "@/domain/otp-code";
import { normalizePhone } from "@/domain/phone";
import { recordAuthEvent } from "@/server/auth/audit";
import { verifyOtp } from "@/server/auth/otp-store";
import { fail, type AuthResult } from "@/server/auth/result";
import { createSession, grantPasswordReset } from "@/server/auth/session";
import { findOrCreateUserByPhone, touchLastLogin } from "@/server/auth/users";
import type { ClientMeta } from "@/server/http";

export type OtpPurpose = "LOGIN" | "RESET_PASSWORD";

export type OtpVerifyData = {
  sessionId: string;
  hasPassword: boolean;
};

/** Why: a correct code signs the user in immediately, and a reset purpose also arms that new session. */
export async function verifyOtpLogin(input: {
  phoneNumber: string;
  code: string;
  purpose: OtpPurpose;
  client: ClientMeta;
}): Promise<AuthResult<OtpVerifyData>> {
  const phone = normalizePhone(input.phoneNumber);
  const code = normalizeOtpCode(input.code);
  if (!phone || !code) {
    return fail({ status: 400, code: "INVALID_BODY", message: messages.invalidBody });
  }
  const verdict = await verifyOtp({ phone, code });
  if (verdict.status === "MISMATCH") {
    await recordAuthEvent({
      type: "OTP_VERIFY_FAILURE",
      phone,
      ip: input.client.ip,
      userAgent: input.client.userAgent,
    });
    return fail({
      status: 401,
      code: "OTP_MISMATCH",
      message: messages.otpMismatch,
      attemptsRemaining: verdict.attemptsRemaining,
    });
  }
  if (verdict.status === "EXHAUSTED") {
    await recordAuthEvent({
      type: "OTP_VERIFY_FAILURE",
      phone,
      ip: input.client.ip,
      userAgent: input.client.userAgent,
    });
    return fail({ status: 401, code: "OTP_EXHAUSTED", message: messages.otpExhausted });
  }
  if (verdict.status === "EXPIRED") {
    return fail({ status: 401, code: "OTP_EXPIRED", message: messages.otpExpired });
  }
  const user = await findOrCreateUserByPhone(phone);
  await touchLastLogin(user.id);
  const sessionId = await createSession({
    userId: user.id,
    ip: input.client.ip,
    userAgent: input.client.userAgent,
  });
  if (input.purpose === "RESET_PASSWORD") {
    await grantPasswordReset(sessionId);
  }
  await recordAuthEvent({
    type: "OTP_VERIFY_SUCCESS",
    phone,
    ip: input.client.ip,
    userAgent: input.client.userAgent,
    userId: user.id,
  });
  return {
    ok: true,
    data: { sessionId, hasPassword: user.passwordHash !== null },
  };
}
