import { normalizeDigits } from "@/domain/digits";

const CARD_LENGTH = 16;

/** Why: refund requests store a destination PAN as digits only, never letters or separators. */
export function parseCardNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const digits = normalizeDigits(value).replace(/\D/g, "");
  if (digits.length !== CARD_LENGTH) {
    return null;
  }
  return digits;
}

/** Why: list responses must never show a full PAN. */
export function maskCardNumber(cardNumber: string): string {
  return `${cardNumber.slice(0, 6)}******${cardNumber.slice(-4)}`;
}
