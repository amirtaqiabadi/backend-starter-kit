import { messages } from "@/domain/messages";
import { recordAuthEvent } from "@/server/auth/audit";
import { hashPassword } from "@/server/auth/passwords";
import { policyFailure } from "@/server/auth/password-set";
import { fail, type AuthResult } from "@/server/auth/result";
import { consumePasswordReset, invalidateOtherSessions, readSession } from "@/server/auth/session";
import { getPrisma } from "@/server/db";

/** Why: only a session that just verified an OTP for reset may replace an existing password. */
export async function resetPassword(input: {
  sessionId: string | null;
  password: string;
}): Promise<AuthResult<{ userId: number }>> {
  const policyError = policyFailure(input.password);
  if (policyError) {
    return policyError;
  }
  const session = await readSession(input.sessionId);
  if (!session) {
    return fail({ status: 401, code: "UNAUTHORIZED", message: messages.unauthorized });
  }
  const allowed = await consumePasswordReset(session.sessionId);
  if (!allowed) {
    return fail({ status: 403, code: "RESET_NOT_ALLOWED", message: messages.resetNotAllowed });
  }
  const passwordHash = await hashPassword(input.password);
  const user = await getPrisma().user.update({
    where: { id: session.userId },
    data: { passwordHash, passwordSetAt: new Date() },
  });
  await invalidateOtherSessions({ userId: user.id, sessionId: session.sessionId });
  await recordAuthEvent({
    type: "PASSWORD_RESET",
    phone: user.phoneNumber,
    ip: session.ip,
    userAgent: session.userAgent,
    userId: user.id,
  });
  return { ok: true, data: { userId: user.id } };
}
