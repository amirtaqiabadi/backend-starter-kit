import { Prisma } from "../../../generated/prisma/client";
import { maskCardNumber, parseCardNumber } from "@/domain/payment/card";
import { paymentMessages } from "@/domain/payment/messages";
import { getPrisma } from "@/server/db";
import { decryptCardNumber, encryptCardNumber } from "@/server/payment/card-crypto";
import { paymentConfig } from "@/server/payment/config";
import { jsonAmount } from "@/server/payment/metadata";
import { paymentFail, type PaymentResult } from "@/server/payment/result";
import { requireOwnerTeam } from "@/server/payment/wallets";

export type RefundSummary = {
  id: number;
  teamId: number;
  transactionId: number;
  amount: number;
  status: string;
  cardNumber: string;
  createdAt: string;
};

/** Why: a refund request is a manual card payout row, not a second gateway credit. */
export async function createRefundRequest(input: {
  userId: number;
  transactionId: number;
  cardNumber: unknown;
}): Promise<PaymentResult<RefundSummary>> {
  const cardNumber = parseCardNumber(input.cardNumber);
  if (!cardNumber) {
    return paymentFail({
      status: 400,
      type: "VALIDATION_ERROR",
      code: "CARD_INVALID",
      message: paymentMessages.cardInvalid,
    });
  }
  const transaction = await getPrisma().transaction.findUnique({
    where: { id: input.transactionId },
    include: { gatewayAttempt: true },
  });
  if (!transaction || transaction.type !== "GatewayCredit") {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REFUND_NOT_ALLOWED",
      message: paymentMessages.refundNotAllowed,
    });
  }
  const reversed = transaction.gatewayAttemptId
    ? await getPrisma().transaction.findFirst({
        where: { gatewayAttemptId: transaction.gatewayAttemptId, type: "Reverse" },
      })
    : null;
  if (refundBlocked({ reverseExists: reversed !== null, status: transaction.gatewayAttempt?.status })) {
    return paymentFail({
      status: 409,
      type: "DOMAIN_ERROR",
      code: "REFUND_NOT_ALLOWED",
      message: paymentMessages.refundNotAllowed,
    });
  }
  const owner = await requireOwnerTeam({ userId: input.userId, teamId: transaction.teamId });
  if (!owner.ok) {
    return owner;
  }
  if (paymentConfig().cardEncryptionKey.length < 32) {
    return paymentFail({
      status: 503,
      type: "SYSTEM_ERROR",
      code: "GATEWAY_UNAVAILABLE",
      message: paymentMessages.gatewayUnavailable,
    });
  }
  try {
    const created = await insertPendingRefund({
      userId: input.userId,
      teamId: transaction.teamId,
      transactionId: transaction.id,
      gatewayAttemptId: transaction.gatewayAttemptId,
      amount: transaction.amount,
      cardNumber: encryptCardNumber(cardNumber),
    });
    return { ok: true, data: toSummary(created) };
  } catch (error) {
    if (error instanceof RefundRejected) {
      return paymentFail({
        status: 409,
        type: "DOMAIN_ERROR",
        code: error.reason,
        message: error.reason === "REFUND_EXISTS" ? paymentMessages.refundExists : paymentMessages.refundNotAllowed,
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return paymentFail({
        status: 409,
        type: "DOMAIN_ERROR",
        code: "REFUND_EXISTS",
        message: paymentMessages.refundExists,
      });
    }
    throw error;
  }
}

/** Why: the attempt row must stay locked until the refund insert commits, or reverse can start in between. */
async function insertPendingRefund(input: {
  userId: number;
  teamId: number;
  transactionId: number;
  gatewayAttemptId: number | null;
  amount: bigint;
  cardNumber: string;
}) {
  return getPrisma().$transaction(async (tx) => {
    if (input.gatewayAttemptId !== null) {
      await tx.$queryRaw`SELECT id FROM gateway_attempts WHERE id = ${input.gatewayAttemptId} FOR UPDATE`;
      const attempt = await tx.gatewayAttempt.findUnique({ where: { id: input.gatewayAttemptId } });
      const reverse = await tx.transaction.findFirst({
        where: { gatewayAttemptId: input.gatewayAttemptId, type: "Reverse" },
      });
      if (refundBlocked({ reverseExists: reverse !== null, status: attempt?.status })) {
        throw new RefundRejected("REFUND_NOT_ALLOWED");
      }
    }
    return tx.refundRequest.create({
      data: {
        initiatorId: input.userId,
        teamId: input.teamId,
        transactionId: input.transactionId,
        cardNumber: input.cardNumber,
        amount: input.amount,
        status: "pending",
      },
    });
  });
}

/** Why: reverse and a manual card refund are two payouts of one credit. */
function refundBlocked(input: { reverseExists: boolean; status: string | undefined }): boolean {
  return input.reverseExists || input.status === "reversed" || input.status === "reverse_pending";
}

class RefundRejected extends Error {
  readonly reason: "REFUND_NOT_ALLOWED" | "REFUND_EXISTS";

  constructor(reason: "REFUND_NOT_ALLOWED" | "REFUND_EXISTS") {
    super(reason);
    this.reason = reason;
  }
}

/** Why: list responses mask the PAN so logs and Swagger copies cannot leak 16 digits. */
export async function listRefundRequests(input: {
  userId: number;
  teamId: number;
}): Promise<PaymentResult<RefundSummary[]>> {
  const owner = await requireOwnerTeam({ userId: input.userId, teamId: input.teamId });
  if (!owner.ok) {
    return owner;
  }
  const rows = await getPrisma().refundRequest.findMany({
    where: { teamId: input.teamId },
    orderBy: { createdAt: "desc" },
  });
  return { ok: true, data: rows.map(toSummary) };
}

function toSummary(row: {
  id: number;
  teamId: number;
  transactionId: number;
  amount: bigint;
  status: string;
  cardNumber: string;
  createdAt: Date;
}): RefundSummary {
  return {
    id: row.id,
    teamId: row.teamId,
    transactionId: row.transactionId,
    amount: jsonAmount(row.amount),
    status: row.status,
    cardNumber: maskStoredCard(row.cardNumber),
    createdAt: row.createdAt.toISOString(),
  };
}

function maskStoredCard(stored: string): string {
  const pan = decryptCardNumber(stored);
  if (pan) {
    return maskCardNumber(pan);
  }
  return "************";
}
