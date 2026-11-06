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
  userId: string;
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
  if (reversed || transaction.gatewayAttempt?.status === "reversed" || transaction.gatewayAttempt?.status === "reverse_pending") {
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
    const created = await getPrisma().refundRequest.create({
      data: {
        initiatorId: input.userId,
        teamId: transaction.teamId,
        transactionId: transaction.id,
        cardNumber: encryptCardNumber(cardNumber),
        amount: transaction.amount,
        status: "pending",
      },
    });
    return { ok: true, data: toSummary(created) };
  } catch (error) {
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

/** Why: list responses mask the PAN so logs and Swagger copies cannot leak 16 digits. */
export async function listRefundRequests(input: {
  userId: string;
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
