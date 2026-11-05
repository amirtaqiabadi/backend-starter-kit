import { normalizeDigits } from "@/domain/digits";

const LOCAL_IRAN_PHONE = /^09\d{9}$/;

/** Why: every store and comparison must use one canonical 11-digit local number. */
export function normalizePhone(input: string): string | null {
  const normalized = normalizeDigits(input.trim());
  if (!LOCAL_IRAN_PHONE.test(normalized)) {
    return null;
  }
  return normalized;
}
