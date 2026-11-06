import { describe, expect, it } from "vitest";
import { decryptCardNumber, encryptCardNumber } from "@/server/payment/card-crypto";

describe("card-crypto", () => {
  it("round-trips a PAN and rejects a mutated payload", () => {
    const secret = "test-card-encryption-key-32-chars!";
    const stored = encryptCardNumber("5022291234565995", secret);
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(decryptCardNumber(stored, secret)).toBe("5022291234565995");
    expect(decryptCardNumber(`${stored}x`, secret)).toBeNull();
  });
});
