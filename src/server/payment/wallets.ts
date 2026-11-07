import { Prisma } from "../../../generated/prisma/client";
import { paymentMessages } from "@/domain/payment/messages";
import { parseWalletName, PERSONAL_WALLET_NAME } from "@/domain/payment/wallet-name";
import { getPrisma } from "@/server/db";
import { jsonAmount } from "@/server/payment/metadata";
import { paymentFail, type PaymentResult } from "@/server/payment/result";

export type WalletSummary = {
  teamId: number;
  displayName: string;
  role: string;
  availableBalance: number;
  restrictedBalance: number;
};

/** Why: charging a team is allowed only for an active owner of that team. */
export async function requireOwnerTeam(input: {
  userId: string;
  teamId: number;
}): Promise<PaymentResult<{ teamId: number }>> {
  const membership = await getPrisma().teamMember.findFirst({
    where: {
      userId: input.userId,
      teamId: input.teamId,
      isActive: true,
      status: "active",
      role: "owner",
      team: { isActive: true },
    },
  });
  if (!membership) {
    return paymentFail({
      status: 403,
      type: "DOMAIN_ERROR",
      code: "TEAM_FORBIDDEN",
      message: paymentMessages.teamForbidden,
    });
  }
  return { ok: true, data: { teamId: input.teamId } };
}

/** Why: omitting teamId creates a personal wallet only when the user has no active membership. */
export async function resolveChargeTeam(input: {
  userId: string;
  teamId: number | null;
}): Promise<PaymentResult<{ teamId: number }>> {
  if (input.teamId !== null) {
    return requireOwnerTeam({ userId: input.userId, teamId: input.teamId });
  }
  const owned = await getPrisma().teamMember.findFirst({
    where: {
      userId: input.userId,
      isActive: true,
      status: "active",
      role: "owner",
      team: { isActive: true },
    },
    orderBy: { teamId: "asc" },
  });
  if (owned) {
    return { ok: true, data: { teamId: owned.teamId } };
  }
  const created = await createOwnedWallet({ userId: input.userId, displayName: PERSONAL_WALLET_NAME });
  return { ok: true, data: { teamId: created.teamId } };
}

/** Why: a second wallet is a new team whose creator is the owner. */
export async function createWallet(input: {
  userId: string;
  displayName: unknown;
}): Promise<PaymentResult<WalletSummary>> {
  const displayName = parseWalletName(input.displayName);
  if (!displayName) {
    return paymentFail({
      status: 400,
      type: "VALIDATION_ERROR",
      code: "WALLET_NAME_INVALID",
      message: paymentMessages.walletNameInvalid,
    });
  }
  const created = await createOwnedWallet({ userId: input.userId, displayName });
  return {
    ok: true,
    data: {
      teamId: created.teamId,
      displayName,
      role: "owner",
      availableBalance: 0,
      restrictedBalance: 0,
    },
  };
}

/** Why: the list shows every active membership and reads balance from the latest ledger row. */
export async function listWallets(userId: string): Promise<WalletSummary[]> {
  const memberships = await getPrisma().teamMember.findMany({
    where: { userId, isActive: true, status: "active", team: { isActive: true } },
    orderBy: { teamId: "asc" },
  });
  const balances = await latestBalances(memberships.map((item) => item.teamId));
  return memberships.map((item) => {
    const balance = balances.get(item.teamId) ?? { available: BigInt(0), restricted: BigInt(0) };
    return {
      teamId: item.teamId,
      displayName: item.displayName || PERSONAL_WALLET_NAME,
      role: item.role,
      availableBalance: jsonAmount(balance.available),
      restrictedBalance: jsonAmount(balance.restricted),
    };
  });
}

async function createOwnedWallet(input: { userId: string; displayName: string }) {
  return getPrisma().$transaction(async (tx) => {
    const team = await tx.team.create({ data: {} });
    await tx.teamMember.create({
      data: {
        teamId: team.id,
        userId: input.userId,
        displayName: input.displayName,
        role: "owner",
        status: "active",
        isActive: true,
      },
    });
    return { teamId: team.id };
  });
}

async function latestBalances(teamIds: number[]) {
  const balances = new Map<number, { available: bigint; restricted: bigint }>();
  if (teamIds.length === 0) {
    return balances;
  }
  const rows = await getPrisma().$queryRaw<
    Array<{ team_id: number; available_balance_after: bigint; restricted_balance_after: bigint }>
  >(Prisma.sql`
    SELECT DISTINCT ON (team_id)
      team_id,
      available_balance_after,
      restricted_balance_after
    FROM transactions
    WHERE team_id IN (${Prisma.join(teamIds)})
    ORDER BY team_id, created_at DESC, id DESC
  `);
  for (const row of rows) {
    balances.set(row.team_id, { available: row.available_balance_after, restricted: row.restricted_balance_after });
  }
  return balances;
}
