import { paymentMessages } from "@/domain/payment/messages";
import { isWithinReverseWindow, REVERSE_SUCCESS } from "@/domain/payment/status";
import { getPrisma } from "@/server/db";
import { lockAttemptById, lockLatestBalance } from "@/server/payment/ledger";
import { mergeMetadata } from "@/server/payment/metadata";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import { requireOwnerTeam } from "@/server/payment/wallets";
import { reversePayment } from "@/server/payment/zarinpal";

/** Why: reverse appends a negative ledger row and never deletes the original credit. */
export async function reverseAttempt(input: {
  userId: string;
  attemptId: number;
}): Promise<PaymentResult<{ attemptId: number }>> {
  const attempt = await getPrisma().gatewayAttempt.findUnique({ where: { id: input.attemptId } });
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
  const credit = await getPrisma().transaction.findFirst({
    where: { gatewayAttemptId: attempt.id, type: "GatewayCredit" },
  });
  if (
    !credit ||
    attempt.transactionType !== "gateway_credit" ||
    attempt.status !== "successful" ||
    !attempt.referenceId ||
    !attempt.sessionToken
  ) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REVERSE_NOT_ALLOWED",
      message: paymentMessages.reverseNotAllowed,
    });
  }
  if (!isWithinReverseWindow(credit.createdAt)) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REVERSE_WINDOW_EXPIRED",
      message: paymentMessages.reverseWindowExpired,
    });
  }
  const existingReverse = await getPrisma().transaction.findFirst({
    where: { gatewayAttemptId: attempt.id, type: "Reverse" },
  });
  if (existingReverse) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "ALREADY_REVERSED",
      message: paymentMessages.alreadyReversed,
    });
  }
  try {
    return await getPrisma().$transaction(async (tx) => {
      const locked = await lockAttemptById(tx, attempt.id);
      if (!locked || locked.status !== "50-successful") {
        throw reverseAbort("REVERSE_NOT_ALLOWED", paymentMessages.reverseNotAllowed);
      }
      const reverseRow = await tx.transaction.findFirst({
        where: { gatewayAttemptId: attempt.id, type: "Reverse" },
      });
      if (reverseRow) {
        throw reverseAbort("ALREADY_REVERSED", paymentMessages.alreadyReversed);
      }
      const previous = await lockLatestBalance(tx, locked.team_id);
      if (previous.available < locked.amount) {
        throw reverseAbort("INSUFFICIENT_BALANCE", paymentMessages.insufficientBalance);
      }
      await tx.transaction.create({
        data: {
          initiatorId: input.userId,
          teamId: locked.team_id,
          gatewayAttemptId: locked.id,
          type: "Reverse",
          amount: -locked.amount,
          availableBalanceAfter: previous.available - locked.amount,
          restrictedBalanceAfter: previous.restricted,
        },
      });
      const reversed = await reversePayment(attempt.sessionToken ?? "");
      if (!reversed.ok && reversed.kind === "unavailable") {
        await tx.gatewayAttempt.update({
          where: { id: locked.id },
          data: {
            status: "reverse_pending",
            metadata: mergeMetadata(locked.metadata, { reverseNote: "gateway_timeout" }),
          },
        });
        return { ok: true as const, data: { attemptId: locked.id } };
      }
      if (!reversed.ok || reversed.code !== REVERSE_SUCCESS) {
        throw reverseAbort("GATEWAY_REJECTED", paymentMessages.gatewayRejected);
      }
      await tx.gatewayAttempt.update({
        where: { id: locked.id },
        data: {
          status: "reversed",
          metadata: mergeMetadata(locked.metadata, { reverseCode: reversed.code }),
        },
      });
      return { ok: true as const, data: { attemptId: locked.id } };
    }, { timeout: 20_000 });
  } catch (error) {
    if (error instanceof ReverseAbort) {
      const status = error.code === "GATEWAY_REJECTED" ? 502 : error.code === "INSUFFICIENT_BALANCE" ? 409 : 409;
      const type = error.code === "GATEWAY_REJECTED" ? "SYSTEM_ERROR" : "DOMAIN_ERROR";
      return paymentFail({ status, type, code: error.code, message: error.message });
    }
    throw error;
  }
}

class ReverseAbort extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function reverseAbort(code: string, message: string): ReverseAbort {
  return new ReverseAbort(code, message);
}
