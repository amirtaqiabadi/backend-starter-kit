import { getPrisma } from "@/server/db";
import { jsonAmount } from "@/server/payment/metadata";
import type { PaymentResult } from "@/server/payment/result";
import { requireOwnerTeam } from "@/server/payment/wallets";

export type LedgerRow = {
  id: number;
  type: string;
  amount: number;
  availableBalanceAfter: number;
  restrictedBalanceAfter: number;
  gatewayAttemptId: number | null;
  createdAt: string;
};

/** Why: history is the append-only ledger for one team, not a mutable balance field. */
export async function listTeamTransactions(input: {
  userId: number;
  teamId: number;
  page: number;
  limit: number;
}): Promise<PaymentResult<{ transactions: LedgerRow[]; pagination: { page: number; limit: number; hasNextPage: boolean } }>> {
  const owner = await requireOwnerTeam({ userId: input.userId, teamId: input.teamId });
  if (!owner.ok) {
    return owner;
  }
  const rows = await getPrisma().transaction.findMany({
    where: { teamId: input.teamId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (input.page - 1) * input.limit,
    take: input.limit + 1,
  });
  return {
    ok: true,
    data: {
      transactions: rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      type: row.type,
      amount: jsonAmount(row.amount),
      availableBalanceAfter: jsonAmount(row.availableBalanceAfter),
      restrictedBalanceAfter: jsonAmount(row.restrictedBalanceAfter),
      gatewayAttemptId: row.gatewayAttemptId,
      createdAt: row.createdAt.toISOString(),
      })),
      pagination: { page: input.page, limit: input.limit, hasNextPage: rows.length > input.limit },
    },
  };
}
