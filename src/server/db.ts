import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

/** Why: Prisma 7 only connects through a driver adapter, and the dev server must reuse one client. */
export function getPrisma(connectionString = process.env.DATABASE_URL ?? ""): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
