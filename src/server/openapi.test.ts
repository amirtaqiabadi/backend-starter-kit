import { describe, expect, it } from "vitest";
import { openApiDocument } from "@/server/openapi";

describe("openapi", () => {
  it("lists every auth route", () => {
    expect(Object.keys(openApiDocument().paths).sort()).toEqual([
      "/api/auth/identify",
      "/api/auth/otp/request",
      "/api/auth/otp/verify",
      "/api/auth/password/login",
      "/api/auth/password/reset",
      "/api/auth/password/set",
    ]);
  });
});
