import { isUsableAuthority } from "@/domain/payment/authority";
import { paymentMessages } from "@/domain/payment/messages";
import { getPrisma } from "@/server/db";
import { paymentConfig } from "@/server/payment/config";
import { applyVerifyResult } from "@/server/payment/ledger";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import { requireOwnerTeam } from "@/server/payment/wallets";
import { listUnverified, verifyPayment } from "@/server/payment/zarinpal";

/** Why: a missed callback is recovered by verifying a matching pending attempt, never from the list itself. */
export async function recoverPayment(input: {
  userId: string;
  authority?: string;
}): Promise<PaymentResult<{ recovered: number }>> {
  const config = paymentConfig();
  const pending = await pendingAttempts(input);
  if (!pending.ok) {
    return pending;
  }
  let recovered = 0;
  for (const attempt of pending.data) {
    if (!attempt.sessionToken || !isUsableAuthority(attempt.sessionToken, config.sandbox)) {
      continue;
    }
    const verified = await verifyPayment({ authority: attempt.sessionToken, amount: attempt.amount });
    const applied = await applyVerifyResult({
      authority: attempt.sessionToken,
      storedAmount: attempt.amount,
      verify: verified,
    });
    if (applied.ok) {
      recovered += 1;
    }
  }
  return { ok: true, data: { recovered } };
}

async function pendingAttempts(input: { userId: string; authority?: string }) {
  if (input.authority) {
    const attempt = await getPrisma().gatewayAttempt.findFirst({
      where: { sessionToken: input.authority, type: "zarinpal" },
    });
    if (!attempt) {
      return paymentFail({
        status: 404,
        type: "DOMAIN_ERROR",
        code: "ATTEMPT_NOT_FOUND",
        message: paymentMessages.attemptNotFound,
      });
    }
    const owner = await requireOwnerTeam({ userId: input.userId, teamId: attempt.teamId });
    if (!owner.ok) {
      return owner;
    }
    return { ok: true as const, data: [attempt] };
  }
  const unverified = await listUnverified();
  if (!unverified) {
    return paymentFail({
      status: 503,
      type: "SYSTEM_ERROR",
      code: "GATEWAY_UNAVAILABLE",
      message: paymentMessages.gatewayUnavailable,
    });
  }
  const matched = [];
  for (const item of unverified) {
    const attempt = await getPrisma().gatewayAttempt.findFirst({
      where: {
        sessionToken: item.authority,
        amount: item.amount,
        status: "pending",
        type: "zarinpal",
      },
    });
    if (!attempt) {
      continue;
    }
    const owner = await requireOwnerTeam({ userId: input.userId, teamId: attempt.teamId });
    if (!owner.ok) {
      continue;
    }
    matched.push(attempt);
  }
  return { ok: true as const, data: matched };
}
