import { Prisma } from "../../../generated/prisma/client";
import { normalizeToken, generateToken } from "@/domain/token";
import { getPrisma } from "@/server/db";

export type AuthUser = {
  id: number;
  phoneNumber: string;
  passwordHash: string | null;
};

const TOKEN_INSERT_ATTEMPTS = 5;

/** Why: the first successful OTP for a new number must create exactly one user under concurrency. */
export async function findOrCreateUserByPhone(
  phone: string,
  referralToken: string | null = null,
): Promise<AuthUser> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { phoneNumber: phone } });
  if (existing) {
    return existing;
  }
  return insertUser({ phone, referredById: await referrerId(referralToken) });
}

/** Why: a login should stamp the account only after the credential check has succeeded. */
export async function touchLastLogin(userId: number): Promise<void> {
  await getPrisma().user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

/** Why: the signed-in caller needs the public token other people send at signup. */
export async function readUserToken(userId: number): Promise<string | null> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { token: true },
  });
  if (!user) {
    return null;
  }
  return user.token.trim();
}

/** Why: a referral is recorded only when the token already belongs to an account. */
async function referrerId(referralToken: string | null): Promise<number | null> {
  const token = normalizeToken(referralToken ?? "");
  if (!token) {
    return null;
  }
  const referrer = await getPrisma().user.findUnique({ where: { token }, select: { id: true } });
  return referrer?.id ?? null;
}

/** Why: a generated-token collision must be retried, while a phone race must keep the winning row. */
async function insertUser(input: { phone: string; referredById: number | null }): Promise<AuthUser> {
  const prisma = getPrisma();
  for (let attempt = 0; attempt < TOKEN_INSERT_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.user.create({
        data: {
          phoneNumber: input.phone,
          token: generateToken(),
          referredById: input.referredById,
        },
      });
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }
      const raced = await prisma.user.findUnique({ where: { phoneNumber: input.phone } });
      if (raced) {
        return raced;
      }
      if (!isTokenConflict(error)) {
        throw error;
      }
    }
  }
  throw new Error("USER_TOKEN_EXHAUSTED");
}

/** Why: Prisma reports a unique race as P2002, which this flow treats as "the row already exists". */
function isUniqueConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Why: only a collision on the freshly generated token is safe to retry with a new value. */
function isTokenConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  return uniqueTargets(error).some((target) => target.toLowerCase().includes("token"));
}

/** Why: Prisma may report the conflicting columns either as one string or as a list. */
function uniqueTargets(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (typeof target === "string") {
    return [target];
  }
  if (!Array.isArray(target)) {
    return [];
  }
  return target.filter((item): item is string => typeof item === "string");
}
