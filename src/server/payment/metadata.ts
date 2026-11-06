import type { Prisma } from "../../../generated/prisma/client";

/** Why: gateway codes stay on the row while previous non-secret keys are kept. */
export function mergeMetadata(
  existing: Prisma.JsonValue | null | undefined,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...extra } as Prisma.InputJsonValue;
}

/** Why: JSON cannot carry bigint, so API amounts are decimal numbers. */
export function jsonAmount(amount: bigint): number {
  return Number(amount);
}
