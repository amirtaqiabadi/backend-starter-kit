import { describe, expect, it } from "vitest";
import { isVerifySuccessCode, isWithinReverseWindow, shouldVerifyCallback } from "@/domain/payment/status";

describe("payment status rules", () => {
  it("verifies only OK callbacks", () => {
    expect(shouldVerifyCallback("OK")).toBe(true);
    expect(shouldVerifyCallback("NOK")).toBe(false);
  });

  it("treats 100 and 101 as verify success", () => {
    expect(isVerifySuccessCode(100)).toBe(true);
    expect(isVerifySuccessCode(101)).toBe(true);
    expect(isVerifySuccessCode(-50)).toBe(false);
  });

  it("closes the reverse window after 30 minutes", () => {
    const creditedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(isWithinReverseWindow(creditedAt, new Date("2026-01-01T00:29:59.000Z"))).toBe(true);
    expect(isWithinReverseWindow(creditedAt, new Date("2026-01-01T00:30:00.000Z"))).toBe(false);
  });
});
