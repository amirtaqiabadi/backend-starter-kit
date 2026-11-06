export const MIN_AMOUNT_RIALS = BigInt(1000);

/** Why: the gateway only accepts a whole rial amount, never a fee-adjusted or client-suggested figure. */
export function parseAmountRials(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return isValidAmount(value) ? value : null;
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }
    const amount = BigInt(value);
    return isValidAmount(amount) ? amount : null;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const amount = BigInt(value);
    return isValidAmount(amount) ? amount : null;
  }
  return null;
}

/** Why: ZarinPal rejects amounts below 1000 rials with validation code -9. */
export function isValidAmount(amount: bigint): boolean {
  return amount >= MIN_AMOUNT_RIALS;
}

/** Why: HMAC and verify must see the stored bigint as decimal digits with no separators. */
export function amountDigits(amount: bigint): string {
  return amount.toString(10);
}
