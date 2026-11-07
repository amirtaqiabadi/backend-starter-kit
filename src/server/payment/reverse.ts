import { Prisma } from "../../../generated/prisma/client";
import { paymentMessages } from "@/domain/payment/messages";
import { isWithinReverseWindow, REVERSE_SUCCESS } from "@/domain/payment/status";
import { getPrisma } from "@/server/db";
import { lockAttemptById, lockLatestBalance } from "@/server/payment/ledger";
import { mergeMetadata } from "@/server/payment/metadata";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import { requireOwnerTeam } from "@/server/payment/wallets";
import { reversePayment } from "@/server/payment/zarinpal";

type ReverseTx = Prisma.TransactionClient;
type ReverseLocked = { id: number; metadata: Prisma.JsonValue | null };

/** Why: reverse appends a negative ledger row and never deletes the original credit. */
export async function reverseAttempt(input: {
  userId: number;
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
  if (attempt.status === "reversed") {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "ALREADY_REVERSED",
      message: paymentMessages.alreadyReversed,
    });
  }
  const retrying = attempt.status === "reverse_pending";
  const credit = await getPrisma().transaction.findFirst({
    where: { gatewayAttemptId: attempt.id, type: "GatewayCredit" },
  });
  if (!credit || attempt.transactionType !== "gateway_credit" || !attempt.referenceId || !attempt.sessionToken) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REVERSE_NOT_ALLOWED",
      message: paymentMessages.reverseNotAllowed,
    });
  }
  if (!retrying && attempt.status !== "successful") {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REVERSE_NOT_ALLOWED",
      message: paymentMessages.reverseNotAllowed,
    });
  }
  if (!retrying && !isWithinReverseWindow(credit.createdAt)) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REVERSE_WINDOW_EXPIRED",
      message: paymentMessages.reverseWindowExpired,
    });
  }
  try {
    return await getPrisma().$transaction(async (tx) => {
      const locked = await lockAttemptById(tx, attempt.id);
      if (!locked) {
        throw reverseAbort("REVERSE_NOT_ALLOWED", paymentMessages.reverseNotAllowed);
      }
      if (locked.status === "90-reversed") {
        throw reverseAbort("ALREADY_REVERSED", paymentMessages.alreadyReversed);
      }
      const reverseRow = await tx.transaction.findFirst({
        where: { gatewayAttemptId: attempt.id, type: "Reverse" },
      });
      if (await hasOpenRefund(tx, locked.id)) {
        throw reverseAbort("REVERSE_NOT_ALLOWED", paymentMessages.reverseNotAllowed);
      }
      if (locked.status === "70-reverse_pending") {
        return finishGatewayReverse({
          tx,
          locked,
          authority: attempt.sessionToken ?? "",
          alreadyDeducted: true,
        });
      }
      if (locked.status !== "50-successful" || reverseRow) {
        throw reverseAbort(
          reverseRow ? "ALREADY_REVERSED" : "REVERSE_NOT_ALLOWED",
          reverseRow ? paymentMessages.alreadyReversed : paymentMessages.reverseNotAllowed,
        );
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
      return finishGatewayReverse({
        tx,
        locked,
        authority: attempt.sessionToken ?? "",
        alreadyDeducted: false,
      });
    }, { timeout: 20_000 });
  } catch (error) {
    if (error instanceof ReverseAbort) {
      const status = error.code === "GATEWAY_REJECTED" ? 502 : 409;
      const type = error.code === "GATEWAY_REJECTED" ? "SYSTEM_ERROR" : "DOMAIN_ERROR";
      return paymentFail({ status, type, code: error.code, message: error.message });
    }
    throw error;
  }
}

async function finishGatewayReverse(input: {
  tx: ReverseTx;
  locked: ReverseLocked;
  authority: string;
  alreadyDeducted: boolean;
}): Promise<{ ok: true; data: { attemptId: number } }> {
  const reversed = await reversePayment(input.authority);
  if (!reversed.ok && reversed.kind === "unavailable") {
    await input.tx.gatewayAttempt.update({
      where: { id: input.locked.id },
      data: {
        status: "reverse_pending",
        metadata: mergeMetadata(input.locked.metadata, { reverseNote: "gateway_timeout" }),
      },
    });
    return { ok: true, data: { attemptId: input.locked.id } };
  }
  if (reversed.ok && reversed.code === REVERSE_SUCCESS) {
    await markReversed(input.tx, input.locked, reversed.code);
    return { ok: true, data: { attemptId: input.locked.id } };
  }
  if (input.alreadyDeducted && reversed.code === -61) {
    await markReversed(input.tx, input.locked, reversed.code);
    return { ok: true, data: { attemptId: input.locked.id } };
  }
  throw reverseAbort("GATEWAY_REJECTED", paymentMessages.gatewayRejected);
}

/** Why: a pending card refund and a gateway reverse would pay the same credit twice. */
async function hasOpenRefund(tx: ReverseTx, attemptId: number): Promise<boolean> {
  const refund = await tx.refundRequest.findFirst({
    where: {
      status: { notIn: ["rejected", "failed"] },
      transaction: { gatewayAttemptId: attemptId, type: "GatewayCredit" },
    },
    select: { id: true },
  });
  return refund !== null;
}

/** Why: a confirmed gateway reverse must leave the attempt in the terminal reversed status. */
async function markReversed(tx: ReverseTx, locked: ReverseLocked, reverseCode: number | undefined): Promise<void> {
  await tx.gatewayAttempt.update({
    where: { id: locked.id },
    data: {
      status: "reversed",
      metadata: mergeMetadata(locked.metadata, { reverseCode: reverseCode ?? null }),
    },
  });
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
