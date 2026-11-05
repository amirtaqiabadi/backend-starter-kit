import { normalizeDigits } from "@/domain/digits";

const FIVE_DIGITS = /^\d{5}$/;

/** Why: verification must accept the same numeral shapes as the phone field without loosening the 5-digit rule. */
export function normalizeOtpCode(input: string): string | null {
  const normalized = normalizeDigits(input.trim());
  if (!FIVE_DIGITS.test(normalized)) {
    return null;
  }
  return normalized;
}
