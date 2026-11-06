const MAX_DESCRIPTION_LENGTH = 500;

/** Why: ZarinPal requires a description and rejects anything longer than 500 characters. */
export function parsePaymentDescription(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const description = value.trim();
  if (description.length === 0 || description.length > MAX_DESCRIPTION_LENGTH) {
    return null;
  }
  return description;
}
