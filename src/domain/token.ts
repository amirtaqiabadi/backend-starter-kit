import { randomInt } from "node:crypto";

export const TOKEN_ALPHABET = "ACDEFGHJKMNPQRTVWXYZ234679";
const TOKEN_LENGTH = 5;
const TOKEN_PATTERN = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

/** Why: invite links are typed and pasted, so only a canonical 5-character token can be stored. */
export function normalizeToken(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "").toUpperCase();
  if (!TOKEN_PATTERN.test(compact)) {
    return null;
  }
  return compact;
}

/** Why: each account needs a public token that avoids characters people mix up. */
export function generateToken(): string {
  let token = "";
  for (let index = 0; index < TOKEN_LENGTH; index += 1) {
    token += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)];
  }
  return token;
}
