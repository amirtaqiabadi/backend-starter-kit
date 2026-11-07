import { randomBytes } from "node:crypto";
import { parseAmountRials } from "@/domain/payment/amount";
import { isUsableAuthority } from "@/domain/payment/authority";
import { CORRELATION_KEY_BYTE_COUNT, correlationKeyFromBytes } from "@/domain/payment/correlation-key";
import { parsePaymentDescription } from "@/domain/payment/description";
import { paymentMessages } from "@/domain/payment/messages";
import { getPrisma } from "@/server/db";
import { signedCallbackUrl } from "@/server/payment/callback-url";
import { paymentConfig } from "@/server/payment/config";
import { mergeMetadata } from "@/server/payment/metadata";
import { consumeInitiateLimits } from "@/server/payment/rate-limit";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import { resolveChargeTeam } from "@/server/payment/wallets";
import { requestPayment, startPayUrl } from "@/server/payment/zarinpal";

/** Why: a pending attempt is stored before ZarinPal is called so a failed request still has an auditable row. */
export async function initiatePayment(input: {
  userId: number;
  amount: unknown;
  description: unknown;
  teamId: number | null;
  ip: string;
}): Promise<PaymentResult<{ paymentUrl: string; attemptId: number }>> {
  const limited = await consumeInitiateLimits({ userId: input.userId, ip: input.ip });
  if (!limited.allowed) {
    return paymentFail({
      status: 429,
      type: "DOMAIN_ERROR",
      code: "RATE_LIMITED",
      message: paymentMessages.rateLimited,
      retryAfter: limited.retryAfter,
    });
  }
  const amount = parseAmountRials(input.amount);
  if (amount === null) {
    return paymentFail({
      status: 400,
      type: "VALIDATION_ERROR",
      code: "AMOUNT_INVALID",
      message: paymentMessages.amountInvalid,
    });
  }
  const description = parsePaymentDescription(input.description);
  if (!description) {
    return paymentFail({
      status: 400,
      type: "VALIDATION_ERROR",
      code: "DESCRIPTION_INVALID",
      message: paymentMessages.descriptionInvalid,
    });
  }
  const team = await resolveChargeTeam({ userId: input.userId, teamId: input.teamId });
  if (!team.ok) {
    return team;
  }
  const config = paymentConfig();
  if (config.hmacSecret.length < 32 || !config.merchantId) {
    return paymentFail({
      status: 503,
      type: "SYSTEM_ERROR",
      code: "GATEWAY_UNAVAILABLE",
      message: paymentMessages.gatewayUnavailable,
    });
  }
  const attempt = await insertPendingAttempt({
    userId: input.userId,
    teamId: team.data.teamId,
    amount,
  });
  const user = await getPrisma().user.findUnique({ where: { id: input.userId } });
  if (!attempt.callbackUrl) {
    return paymentFail({
      status: 503,
      type: "SYSTEM_ERROR",
      code: "GATEWAY_UNAVAILABLE",
      message: paymentMessages.gatewayUnavailable,
    });
  }
  const requested = await requestPayment({
    amount,
    description,
    callbackUrl: attempt.callbackUrl,
    mobile: user?.phoneNumber,
  });
  if (!requested.ok || !isUsableAuthority(requested.authority, config.sandbox)) {
    await markAttemptFailed(attempt.id, {
      gatewayCode: requested.ok ? null : requested.code,
      reason: requested.ok ? "INVALID_AUTHORITY" : requested.kind,
    });
    return paymentFail({
      status: 502,
      type: "SYSTEM_ERROR",
      code: requested.ok || requested.kind === "rejected" ? "GATEWAY_REJECTED" : "GATEWAY_UNAVAILABLE",
      message:
        requested.ok || requested.kind === "rejected"
          ? paymentMessages.gatewayRejected
          : paymentMessages.gatewayUnavailable,
    });
  }
  await getPrisma().gatewayAttempt.update({
    where: { id: attempt.id },
    data: {
      sessionToken: requested.authority,
      fee: requested.fee,
      metadata: mergeMetadata(attempt.metadata, { requestCode: requested.code }),
    },
  });
  return { ok: true, data: { paymentUrl: startPayUrl(requested.authority), attemptId: attempt.id } };
}

async function insertPendingAttempt(input: { userId: number; teamId: number; amount: bigint }) {
  const salt = randomBytes(32).toString("base64");
  const created = await getPrisma().gatewayAttempt.create({
    data: {
      merchantCorrelationKey: correlationKeyFromBytes(randomBytes(CORRELATION_KEY_BYTE_COUNT)),
      initiatorId: input.userId,
      teamId: input.teamId,
      type: "zarinpal",
      transactionType: "gateway_credit",
      status: "pending",
      salt,
      amount: input.amount,
      fee: BigInt(0),
    },
  });
  const callbackUrl = signedCallbackUrl({ attemptId: created.id, amount: input.amount, salt });
  return getPrisma().gatewayAttempt.update({
    where: { id: created.id },
    data: { callbackUrl },
  });
}

async function markAttemptFailed(attemptId: number, extra: Record<string, unknown>): Promise<void> {
  const current = await getPrisma().gatewayAttempt.findUnique({ where: { id: attemptId } });
  if (!current || current.status !== "pending") {
    return;
  }
  await getPrisma().gatewayAttempt.update({
    where: { id: attemptId },
    data: { status: "failed", metadata: mergeMetadata(current.metadata, extra) },
  });
}
