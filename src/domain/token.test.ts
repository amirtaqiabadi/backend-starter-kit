import { describe, expect, it } from "vitest";
import { generateToken, normalizeToken, TOKEN_ALPHABET } from "@/domain/token";

const TOKEN_PATTERN = new RegExp(`^[${TOKEN_ALPHABET}]{5}$`);

describe("normalizeToken", () => {
  it("uppercases and drops spaces and hyphens", () => {
    expect(normalizeToken(" a2c4-6 ")).toBe("A2C46");
  });

  it("rejects the wrong length and every excluded lookalike", () => {
    expect(normalizeToken("A2C4")).toBeNull();
    expect(normalizeToken("A2C467")).toBeNull();
    for (const character of ["0", "O", "1", "I", "L", "8", "B", "5", "S", "U"]) {
      expect(normalizeToken(`A2C4${character}`)).toBeNull();
    }
  });
});

describe("generateToken", () => {
  it("returns five characters from the readable alphabet", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(generateToken()).toMatch(TOKEN_PATTERN);
    }
  });
});
