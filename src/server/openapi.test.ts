import { describe, expect, it } from "vitest";
import { openApiDocument } from "@/server/openapi";

describe("openapi", () => {
  it("lists every documented route", () => {
    expect(Object.keys(openApiDocument().paths).sort()).toEqual([
      "/api/v1/auth/identify",
      "/api/v1/auth/otp/request",
      "/api/v1/auth/otp/verify",
      "/api/v1/auth/password/login",
      "/api/v1/auth/password/reset",
      "/api/v1/auth/password/set",
      "/api/v1/auth/token",
      "/api/v1/payment/callback/zarinpal",
      "/api/v1/payment/initiate",
      "/api/v1/payment/recover",
      "/api/v1/payment/refunds",
      "/api/v1/payment/reverse",
      "/api/v1/wallets",
      "/api/v1/wallets/{teamId}/transactions",
    ]);
  });
});
