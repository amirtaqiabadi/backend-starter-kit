const MAX_WALLET_NAME = 80;

/** Why: wallet display_name lives on membership and must stay a short human label. */
export function parseWalletName(value: unknown, fallback = "Wallet"): string | null {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value !== "string") {
    return null;
  }
  const name = value.trim();
  if (name.length === 0 || name.length > MAX_WALLET_NAME) {
    return null;
  }
  return name;
}

export const PERSONAL_WALLET_NAME = "Personal wallet";
