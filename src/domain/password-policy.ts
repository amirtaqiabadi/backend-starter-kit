const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "11111111",
  "00000000",
  "abcdefgh",
  "letmein1",
  "iloveyou",
  "admin123",
  "12341234",
]);

export type PasswordPolicyResult = "OK" | "TOO_SHORT" | "TOO_LONG" | "TOO_COMMON";

/** Why: length and a small denylist are the only password rules this product enforces. */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 8) {
    return "TOO_SHORT";
  }
  if (password.length > 128) {
    return "TOO_LONG";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "TOO_COMMON";
  }
  return "OK";
}
