import { describe, expect, it } from "vitest";
import { normalizeOtpCode } from "@/domain/otp-code";
import { normalizePhone } from "@/domain/phone";

describe("normalizePhone", () => {
  it("accepts the local Iranian format", () => {
    expect(normalizePhone("09123456789")).toBe("09123456789");
  });

  it("rejects formats other than 09XXXXXXXXX", () => {
    expect(normalizePhone("9123456789")).toBeNull();
    expect(normalizePhone("+989123456789")).toBeNull();
    expect(normalizePhone("00989123456789")).toBeNull();
    expect(normalizePhone("0912345678")).toBeNull();
    expect(normalizePhone("091234567890")).toBeNull();
    expect(normalizePhone("09123abc789")).toBeNull();
    expect(normalizePhone("0912 3456789")).toBeNull();
  });

  it("trims surrounding spaces and converts Persian and Arabic digits", () => {
    expect(normalizePhone(" 09123456789 ")).toBe("09123456789");
    expect(normalizePhone("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789");
    expect(normalizePhone("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  });
});

describe("normalizeOtpCode", () => {
  it("accepts five Latin or Persian digits only", () => {
    expect(normalizeOtpCode("12345")).toBe("12345");
    expect(normalizeOtpCode("۱۲۳۴۵")).toBe("12345");
    expect(normalizeOtpCode("1234")).toBeNull();
    expect(normalizeOtpCode("123456")).toBeNull();
  });
});
