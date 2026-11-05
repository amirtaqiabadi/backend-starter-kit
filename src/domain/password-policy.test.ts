import { describe, expect, it } from "vitest";
import { checkPasswordPolicy } from "@/domain/password-policy";

describe("checkPasswordPolicy", () => {
  it("accepts a long enough uncommon password", () => {
    expect(checkPasswordPolicy("correct-horse")).toBe("OK");
  });

  it("rejects short, long, and trivially common passwords", () => {
    expect(checkPasswordPolicy("short")).toBe("TOO_SHORT");
    expect(checkPasswordPolicy("a".repeat(129))).toBe("TOO_LONG");
    expect(checkPasswordPolicy("password1")).toBe("TOO_COMMON");
  });
});
