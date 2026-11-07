import { Prisma } from "../../../generated/prisma/client";
import { paymentMessages } from "@/domain/payment/messages";
import { VERIFY_AMOUNT_MISMATCH } from "@/domain/payment/status";
import { getPrisma } from "@/server/db";
import { mergeMetadata } from "@/server/payment/metadata";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import type { ZarinpalVerifyResult } from "@/server/payment/zarinpal";

type LockedAttempt = {
  id: number;
  initiator_id: number;
  team_id: number;
  status: string;
  amount: bigint;
  fee: bigint;
  metadata: Prisma.JsonValue | null;
  session_token: string | null;
  salt: string | null;
};

type LockedBalance = {
  available: bigint;
  restricted: bigint;
};

/** Why: credit and reverse must serialize on the same attempt row the HMAC already authenticated. */
export async function applyVerifyResult(input: {
  authority: string;
  storedAmount: bigint;
  verify: ZarinpalVerifyResult;
}): Promise<PaymentResult<{ attemptId: number }>> {
  return getPrisma().$transaction(async (tx) => {
    const attempt = await lockAttemptByAuthority(tx, input.authority, input.storedAmount);
    if (!attempt) {
      return paymentFail({
        status: 404,
        type: "DOMAIN_ERROR",
        code: "ATTEMPT_NOT_FOUND",
        message: paymentMessages.attemptNotFound,
      });
    }
    if (!input.verify.ok) {
      return rejectLockedAttempt({
        tx,
        attempt,
        code: input.verify.code,
        reason: input.verify.code === VERIFY_AMOUNT_MISMATCH ? "AMOUNT_MISMATCH" : "PAYMENT_NOT_VERIFIED",
      });
    }
    if (input.verify.amount !== undefined && input.verify.amount !== attempt.amount) {
      return rejectLockedAttempt({ tx, attempt, code: VERIFY_AMOUNT_MISMATCH, reason: "AMOUNT_MISMATCH" });
    }
    const existingCredit = await tx.transaction.findFirst({
      where: { gatewayAttemptId: attempt.id, type: "GatewayCredit" },
    });
    if (existingCredit) {
      if (attempt.status === "10-pending") {
        await tx.gatewayAttempt.update({
          where: { id: attempt.id },
          data: { status: "successful" },
        });
      }
      return { ok: true as const, data: { attemptId: attempt.id } };
    }
    if (attempt.status !== "10-pending" && attempt.status !== "50-successful") {
      return paymentFail({
        status: 409,
        type: "DOMAIN_ERROR",
        code: "PAYMENT_NOT_VERIFIED",
        message: paymentMessages.paymentNotVerified,
      });
    }
    const previous = await lockLatestBalance(tx, attempt.team_id);
    const creditAmount = attempt.amount;
    await tx.gatewayAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "successful",
        referenceId: input.verify.refId || undefined,
        maskedPan: input.verify.cardPan || undefined,
        hashedPan: input.verify.cardHash || undefined,
        fee: input.verify.fee,
        metadata: mergeMetadata(attempt.metadata, { verifyCode: input.verify.code }),
      },
    });
    try {
      await tx.transaction.create({
        data: {
          initiatorId: attempt.initiator_id,
          teamId: attempt.team_id,
          gatewayAttemptId: attempt.id,
          type: "GatewayCredit",
          amount: creditAmount,
          availableBalanceAfter: previous.available + creditAmount,
          restrictedBalanceAfter: previous.restricted,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        throw error;
      }
    }
    return { ok: true as const, data: { attemptId: attempt.id } };
  });
}

/** Why: NOK and other terminal failures may mark only a still-pending row. */
export async function failPendingAttempt(input: {
  authority: string;
  extra: Record<string, unknown>;
}): Promise<void> {
  await getPrisma().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedAttempt[]>`
      SELECT id, initiator_id, team_id, status::text, amount, fee, metadata, session_token, salt
      FROM gateway_attempts
      WHERE session_token = ${input.authority} AND status = '10-pending'
      FOR UPDATE
    `;
    const attempt = rows[0];
    if (!attempt) {
      return;
    }
    await tx.gatewayAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "failed",
        metadata: mergeMetadata(attempt.metadata, input.extra),
      },
    });
  });
}

export async function lockAttemptById(
  tx: Prisma.TransactionClient,
  attemptId: number,
): Promise<LockedAttempt | null> {
  const rows = await tx.$queryRaw<LockedAttempt[]>`
    SELECT id, initiator_id, team_id, status::text, amount, fee, metadata, session_token, salt
    FROM gateway_attempts
    WHERE id = ${attemptId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockLatestBalance(
  tx: Prisma.TransactionClient,
  teamId: number,
): Promise<LockedBalance> {
  await tx.$queryRaw`SELECT id FROM teams WHERE id = ${teamId} FOR UPDATE`;
  const rows = await tx.$queryRaw<
    Array<{ available_balance_after: bigint; restricted_balance_after: bigint }>
  >`
    SELECT available_balance_after, restricted_balance_after
    FROM transactions
    WHERE team_id = ${teamId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return { available: BigInt(0), restricted: BigInt(0) };
  }
  return { available: row.available_balance_after, restricted: row.restricted_balance_after };
}

async function lockAttemptByAuthority(
  tx: Prisma.TransactionClient,
  authority: string,
  amount: bigint,
): Promise<LockedAttempt | null> {
  const rows = await tx.$queryRaw<LockedAttempt[]>`
    SELECT id, initiator_id, team_id, status::text, amount, fee, metadata, session_token, salt
    FROM gateway_attempts
    WHERE session_token = ${authority} AND amount = ${amount}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function rejectLockedAttempt(input: {
  tx: Prisma.TransactionClient;
  attempt: LockedAttempt;
  code?: number;
  reason: "AMOUNT_MISMATCH" | "PAYMENT_NOT_VERIFIED";
}): Promise<PaymentFailureResult> {
  if (input.attempt.status === "10-pending") {
    await input.tx.gatewayAttempt.update({
      where: { id: input.attempt.id },
      data: {
        status: "failed",
        metadata: mergeMetadata(input.attempt.metadata, { verifyCode: input.code ?? null, reason: input.reason }),
      },
    });
  }
  const message =
    input.reason === "AMOUNT_MISMATCH" ? paymentMessages.amountMismatch : paymentMessages.paymentNotVerified;
  return paymentFail({
    status: 409,
    type: "DOMAIN_ERROR",
    code: input.reason,
    message,
  });
}

type PaymentFailureResult = ReturnType<typeof paymentFail>;
