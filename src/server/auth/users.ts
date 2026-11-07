import { Prisma } from "../../../generated/prisma/client";
import { getPrisma } from "@/server/db";

export type AuthUser = {
  id: number;
  phoneNumber: string;
  passwordHash: string | null;
};

/** Why: the first successful OTP for a new number must create exactly one user under concurrency. */
export async function findOrCreateUserByPhone(phone: string): Promise<AuthUser> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (existing) {
    return existing;
  }
  try {
    return await prisma.user.create({ data: { phoneNumber: phone } });
  } catch (error) {
    if (!isUniqueConflict(error)) {
      throw error;
    }
    const raced = await prisma.user.findUnique({ where: { phoneNumber: phone } });
    if (!raced) {
      throw error;
    }
    return raced;
  }
}

/** Why: a login should stamp the account only after the credential check has succeeded. */
export async function touchLastLogin(userId: number): Promise<void> {
  await getPrisma().user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

/** Why: Prisma reports a unique race as P2002, which this flow treats as "the row already exists". */
function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
