import { messages } from "@/domain/messages";
import { normalizePhone } from "@/domain/phone";
import { recordAuthEvent } from "@/server/auth/audit";
import { verifyPassword } from "@/server/auth/passwords";
import {
  clearPasswordFailures,
  consumeLoginIpLimit,
  phoneLockStatus,
  recordPasswordFailure,
} from "@/server/auth/rate-limit";
import { fail, type AuthResult } from "@/server/auth/result";
import { createSession } from "@/server/auth/session";
import { touchLastLogin } from "@/server/auth/users";
import type { ClientMeta } from "@/server/http";
import { getPrisma } from "@/server/db";

export type LoginData = { sessionId: string };

/** Why: wrong password, unknown number, and a number without a password must look the same. */
export async function loginWithPassword(input: {
  phoneNumber: string;
  password: string;
  client: ClientMeta;
}): Promise<AuthResult<LoginData>> {
  const phone = normalizePhone(input.phoneNumber);
  if (!phone || typeof input.password !== "string" || input.password.length === 0) {
    return fail({ status: 400, code: "INVALID_BODY", message: messages.invalidBody });
  }
  const ipLimit = await consumeLoginIpLimit(input.client.ip);
  if (!ipLimit.allowed) {
    return fail({
      status: 429,
      code: "RATE_LIMITED",
      message: messages.rateLimited,
      retryAfter: ipLimit.retryAfter,
    });
  }
  const lock = await phoneLockStatus(phone);
  if (!lock.allowed) {
    return fail({
      status: 429,
      code: "LOCKED",
      message: messages.rateLimited,
      retryAfter: lock.retryAfter,
    });
  }
  const user = await getPrisma().user.findUnique({ where: { phoneNumber: phone } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !passwordOk) {
    await recordPasswordFailure(phone);
    await recordAuthEvent({
      type: "LOGIN_FAILURE",
      phone,
      ip: input.client.ip,
      userAgent: input.client.userAgent,
      userId: user?.id ?? null,
    });
    return fail({ status: 401, code: "INVALID_CREDENTIALS", message: messages.genericLogin });
  }
  await clearPasswordFailures(phone);
  await touchLastLogin(user.id);
  const sessionId = await createSession({
    userId: user.id,
    ip: input.client.ip,
    userAgent: input.client.userAgent,
  });
  await recordAuthEvent({
    type: "LOGIN_SUCCESS",
    phone,
    ip: input.client.ip,
    userAgent: input.client.userAgent,
    userId: user.id,
  });
  return { ok: true, data: { sessionId } };
}
