import { describe, expect, it } from "vitest";
import { amountDigits, parseAmountRials } from "@/domain/payment/amount";

describe("parseAmountRials", () => {
  it("accepts whole rial amounts of at least 1000", () => {
    expect(parseAmountRials(1000)).toBe(BigInt(1000));
    expect(parseAmountRials("2500")).toBe(BigInt(2500));
  });

  it("rejects fractions, negatives, and amounts below the floor", () => {
    expect(parseAmountRials(999)).toBeNull();
    expect(parseAmountRials(10.5)).toBeNull();
    expect(parseAmountRials(-1000)).toBeNull();
    expect(parseAmountRials("1_000")).toBeNull();
  });

  it("prints HMAC digits without separators", () => {
    expect(amountDigits(BigInt(1000))).toBe("1000");
  });
});
