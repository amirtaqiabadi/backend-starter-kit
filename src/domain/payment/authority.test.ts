import { describe, expect, it } from "vitest";
import { isUsableAuthority } from "@/domain/payment/authority";

describe("isUsableAuthority", () => {
  it("requires a sandbox authority to start with S", () => {
    expect(isUsableAuthority("S123", true)).toBe(true);
    expect(isUsableAuthority("A123", true)).toBe(false);
  });

  it("rejects a sandbox authority when sandbox is off", () => {
    expect(isUsableAuthority("A123", false)).toBe(true);
    expect(isUsableAuthority("S123", false)).toBe(false);
  });
});
