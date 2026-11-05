import { messages } from "@/domain/messages";
import { normalizePhone } from "@/domain/phone";
import { recordAuthEvent } from "@/server/auth/audit";
import { assertCaptcha } from "@/server/auth/captcha";
import { createOtpCode, otpCooldownTtl, releaseOtp, storeOtp } from "@/server/auth/otp-store";
import { consumeOtpRequestLimits } from "@/server/auth/rate-limit";
import { fail, type AuthResult } from "@/server/auth/result";
import type { SmsService } from "@/server/sms/sms-service";

export type OtpRequestData = { cooldownSeconds: number; code: string };

/** Why: a new code is stored only after the cooldown and pumping limits pass, and is dropped if SMS fails. */
export async function requestOtp(input: {
  phoneNumber: string;
  ip: string;
  userAgent: string;
  sms: SmsService;
}): Promise<AuthResult<OtpRequestData>> {
  const phone = normalizePhone(input.phoneNumber);
  if (!phone) {
    return fail({ status: 400, code: "INVALID_PHONE", message: messages.invalidPhone });
  }
  const cooldown = await otpCooldownTtl(phone);
  if (cooldown > 0) {
    return fail({
      status: 429,
      code: "OTP_COOLDOWN",
      message: messages.otpCooldown,
      retryAfter: cooldown,
    });
  }
  const limit = await consumeOtpRequestLimits({ phone, ip: input.ip });
  if (!limit.allowed) {
    return fail({
      status: 429,
      code: "RATE_LIMITED",
      message: messages.rateLimited,
      retryAfter: limit.retryAfter,
    });
  }
  await assertCaptcha({ phoneNumber: phone, ip: input.ip });
  const code = createOtpCode();
  await storeOtp({ phone, code });
  try {
    await input.sms.sendOtp(phone, code);
  } catch {
    await releaseOtp(phone);
    return fail({ status: 503, code: "SMS_FAILED", message: messages.smsFailed });
  }
  await recordAuthEvent({
    type: "OTP_REQUEST",
    phone,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  const cooldownSeconds = await otpCooldownTtl(phone);
  return { ok: true, data: { cooldownSeconds, code } };
}
