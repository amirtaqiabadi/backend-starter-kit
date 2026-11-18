import { maskCardNumber, parseCardNumber } from "@/domain/payment/card";
import { paymentMessages } from "@/domain/payment/messages";
import { getPrisma } from "@/server/db";
import { lockLatestBalance } from "@/server/payment/ledger";
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

/** Reserve the requested available balance and record the manual payout atomically. */
export async function createRefundRequest(input: {
  userId: number;
  teamId: number;
  amount: number;
  cardNumber: unknown;
}): Promise<PaymentResult<RefundSummary>> {
  const cardNumber = parseCardNumber(input.cardNumber);
  if (!cardNumber) {
    return paymentFail({ status: 400, type: "VALIDATION_ERROR", code: "CARD_INVALID", message: paymentMessages.cardInvalid });
  }
  const owner = await requireOwnerTeam({ userId: input.userId, teamId: input.teamId });
  if (!owner.ok) return owner;
  return getPrisma().$transaction(async (tx) => {
    const balance = await lockLatestBalance(tx, input.teamId);
    const amount = BigInt(input.amount);
    if (balance.available < amount) {
      return paymentFail({ status: 409, type: "DOMAIN_ERROR", code: "INSUFFICIENT_BALANCE", message: paymentMessages.insufficientBalance });
    }
    const debit = await tx.transaction.create({ data: {
      initiatorId: input.userId,
      teamId: input.teamId,
      type: "Refund",
      amount: -amount,
      availableBalanceAfter: balance.available - amount,
      restrictedBalanceAfter: balance.restricted,
    } });
    const created = await tx.refundRequest.create({ data: {
      initiatorId: input.userId,
      teamId: input.teamId,
      transactionId: debit.id,
      amount,
      cardNumber,
      status: "pending",
    } });
    return { ok: true as const, data: toSummary(created) };
  });
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
    cardNumber: maskCardNumber(row.cardNumber),
    createdAt: row.createdAt.toISOString(),
  };
}

