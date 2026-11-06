import { isSandboxAuthority, isUsableAuthority } from "@/domain/payment/authority";
import { callbackHmacMatches, callbackHmacPayload } from "@/domain/payment/hmac";
import { paymentMessages } from "@/domain/payment/messages";
import { shouldVerifyCallback } from "@/domain/payment/status";
import { getPrisma } from "@/server/db";
import { paymentConfig } from "@/server/payment/config";
import { applyVerifyResult, failPendingAttempt } from "@/server/payment/ledger";
import { consumeCallbackLimit } from "@/server/payment/rate-limit";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import { verifyPayment } from "@/server/payment/zarinpal";

export type CallbackOutcome = PaymentResult<{ attemptId: number }>;

/** Why: HMAC is checked before any status change, and NOK never calls verify. */
export async function handleZarinpalCallback(input: {
  sig: string;
  authority: string;
  status: string;
  ip: string;
}): Promise<CallbackOutcome> {
  const limited = await consumeCallbackLimit(input.ip);
  if (!limited.allowed) {
    return paymentFail({
      status: 429,
      type: "DOMAIN_ERROR",
      code: "RATE_LIMITED",
      message: paymentMessages.rateLimited,
      retryAfter: limited.retryAfter,
    });
  }
  if (!input.authority) {
    return notFound();
  }
  const attempt = await getPrisma().gatewayAttempt.findFirst({
    where: { sessionToken: input.authority, type: "zarinpal" },
  });
  if (!attempt || !attempt.salt) {
    return notFound();
  }
  const config = paymentConfig();
  const matches = callbackHmacMatches({
    secret: config.hmacSecret,
    payload: callbackHmacPayload({ attemptId: attempt.id, amount: attempt.amount, salt: attempt.salt }),
    signature: input.sig,
  });
  if (!matches) {
    return paymentFail({
      status: 403,
      type: "DOMAIN_ERROR",
      code: "INVALID_CALLBACK_SIGNATURE",
      message: paymentMessages.invalidCallbackSignature,
    });
  }
  if (!shouldVerifyCallback(input.status)) {
    await failPendingAttempt({ authority: input.authority, extra: { gatewayStatus: input.status } });
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "PAYMENT_NOT_VERIFIED",
      message: paymentMessages.paymentNotVerified,
    });
  }
  if (!isUsableAuthority(input.authority, config.sandbox) || (!config.sandbox && isSandboxAuthority(input.authority))) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "PAYMENT_NOT_VERIFIED",
      message: paymentMessages.paymentNotVerified,
    });
  }
  const verified = await verifyPayment({ authority: input.authority, amount: attempt.amount });
  if (!verified.ok && verified.kind === "unavailable") {
    return paymentFail({
      status: 503,
      type: "SYSTEM_ERROR",
      code: "GATEWAY_UNAVAILABLE",
      message: paymentMessages.gatewayUnavailable,
    });
  }
  return applyVerifyResult({
    authority: input.authority,
    storedAmount: attempt.amount,
    verify: verified,
  });
}

function notFound(): CallbackOutcome {
  return paymentFail({
    status: 404,
    type: "DOMAIN_ERROR",
    code: "ATTEMPT_NOT_FOUND",
    message: paymentMessages.attemptNotFound,
  });
}
