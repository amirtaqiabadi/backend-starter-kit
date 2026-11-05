import { messages } from "@/domain/messages";
import { normalizePhone } from "@/domain/phone";
import { consumeIdentifyLimits } from "@/server/auth/rate-limit";
import { fail, type AuthResult } from "@/server/auth/result";
import { getPrisma } from "@/server/db";

export type IdentifyData = { nextStep: "PASSWORD" | "OTP" };

/** Why: the first step only chooses the next screen, and must not say whether the account exists. */
export async function identifyPhone(input: {
  phoneNumber: string;
  ip: string;
}): Promise<AuthResult<IdentifyData>> {
  const phone = normalizePhone(input.phoneNumber);
  if (!phone) {
    return fail({ status: 400, code: "INVALID_PHONE", message: messages.invalidPhone });
  }
  const limit = await consumeIdentifyLimits({ phone, ip: input.ip });
  if (!limit.allowed) {
    return fail({
      status: 429,
      code: "RATE_LIMITED",
      message: messages.rateLimited,
      retryAfter: limit.retryAfter,
    });
  }
  const user = await getPrisma().user.findUnique({
    where: { phoneNumber: phone },
    select: { passwordHash: true },
  });
  if (user?.passwordHash) {
    return { ok: true, data: { nextStep: "PASSWORD" } };
  }
  return { ok: true, data: { nextStep: "OTP" } };
}
