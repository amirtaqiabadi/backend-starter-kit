const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Why: OTP and phone checks must see Latin digits even when the user types Persian or Arabic numerals. */
export function normalizeDigits(value: string): string {
  let normalized = "";
  for (const character of value) {
    const persianIndex = PERSIAN_DIGITS.indexOf(character);
    if (persianIndex >= 0) {
      normalized += String(persianIndex);
      continue;
    }
    const arabicIndex = ARABIC_DIGITS.indexOf(character);
    if (arabicIndex >= 0) {
      normalized += String(arabicIndex);
      continue;
    }
    normalized += character;
  }
  return normalized;
}
