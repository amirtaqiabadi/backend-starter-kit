import { describe, expect, it } from "vitest";
import { maskCardNumber, parseCardNumber } from "@/domain/payment/card";

describe("card number", () => {
  it("keeps 16 digits and masks the middle", () => {
    expect(parseCardNumber("5022291234565995")).toBe("5022291234565995");
    expect(parseCardNumber("۵۰۲۲۲۹۱۲۳۴۵۶۵۹۹۵")).toBe("5022291234565995");
    expect(maskCardNumber("5022291234565995")).toBe("502229******5995");
  });

  it("rejects a PAN that is not 16 digits", () => {
    expect(parseCardNumber("502229123456599")).toBeNull();
    expect(parseCardNumber("5022-2912-3456-5995")).toBe("5022291234565995");
  });
});
