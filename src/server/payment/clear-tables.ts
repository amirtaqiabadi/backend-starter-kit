import { getPrisma } from "@/server/db";

/** Why: wallet tables reference users, so tests must delete them before wiping accounts. */
export async function deleteAllPaymentRows(): Promise<void> {
  const prisma = getPrisma();
  await prisma.refundRequest.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.gatewayAttempt.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
}
