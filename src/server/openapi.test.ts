import { describe, expect, it } from "vitest";
import { openApiDocument } from "@/server/openapi";

describe("openapi", () => {
  it("lists every documented route", () => {
    expect(Object.keys(openApiDocument().paths).sort()).toEqual([
      "/api/auth/identify",
      "/api/auth/otp/request",
      "/api/auth/otp/verify",
      "/api/auth/password/login",
      "/api/auth/password/reset",
      "/api/auth/password/set",
      "/api/auth/token",
      "/api/payment/callback/zarinpal",
      "/api/payment/initiate",
      "/api/payment/recover",
      "/api/payment/refunds",
      "/api/payment/reverse",
      "/api/wallets",
      "/api/wallets/{teamId}/transactions",
    ]);
  });
});
