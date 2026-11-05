import { messages } from "@/domain/messages";
import { checkPasswordPolicy } from "@/domain/password-policy";
import { recordAuthEvent } from "@/server/auth/audit";
import { hashPassword } from "@/server/auth/passwords";
import { fail, type AuthResult } from "@/server/auth/result";
import { readSession } from "@/server/auth/session";
import { getPrisma } from "@/server/db";

/** Why: the optional post-login screen may set a password once and must never overwrite one. */
export async function setPassword(input: {
  sessionId: string | null;
  password: string;
}): Promise<AuthResult<{ userId: string }>> {
  const policyError = policyFailure(input.password);
  if (policyError) {
    return policyError;
  }
  const session = await readSession(input.sessionId);
  if (!session) {
    return fail({ status: 401, code: "UNAUTHORIZED", message: messages.unauthorized });
  }
  const user = await getPrisma().user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return fail({ status: 401, code: "UNAUTHORIZED", message: messages.unauthorized });
  }
  if (user.passwordHash) {
    return fail({ status: 409, code: "PASSWORD_EXISTS", message: messages.passwordAlreadySet });
  }
  const passwordHash = await hashPassword(input.password);
  const updated = await getPrisma().user.updateMany({
    where: { id: user.id, passwordHash: null },
    data: { passwordHash, passwordSetAt: new Date() },
  });
  if (updated.count === 0) {
    return fail({ status: 409, code: "PASSWORD_EXISTS", message: messages.passwordAlreadySet });
  }
  await recordAuthEvent({
    type: "PASSWORD_SET",
    phone: user.phoneNumber,
    ip: session.ip,
    userAgent: session.userAgent,
    userId: user.id,
  });
  return { ok: true, data: { userId: user.id } };
}

/** Why: set and reset share the policy so a rejected password never reaches Argon2. */
export function policyFailure(password: string) {
  if (typeof password !== "string") {
    return fail({ status: 400, code: "INVALID_PASSWORD", message: messages.invalidPassword });
  }
  const result = checkPasswordPolicy(password);
  if (result === "TOO_COMMON") {
    return fail({ status: 400, code: "COMMON_PASSWORD", message: messages.commonPassword });
  }
  if (result !== "OK") {
    return fail({ status: 400, code: "INVALID_PASSWORD", message: messages.invalidPassword });
  }
  return null;
}
