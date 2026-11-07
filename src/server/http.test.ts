import { describe, expect, it } from "vitest";
import { resolveClientIp, secureCookie } from "@/server/http";

describe("resolveClientIp", () => {
  it("ignores forwarded headers until a proxy hop count is configured", () => {
    expect(
      resolveClientIp({
        forwardedFor: "203.0.113.5",
        realIp: "203.0.113.9",
        trustedProxyCount: 0,
        fallback: "unknown",
      }),
    ).toBe("unknown");
  });

  it("uses the hop the trusted proxy appended, not the one the caller prepended", () => {
    expect(
      resolveClientIp({
        forwardedFor: "198.51.100.9, 203.0.113.5",
        realIp: null,
        trustedProxyCount: 1,
        fallback: "unknown",
      }),
    ).toBe("203.0.113.5");
  });
});

describe("secureCookie", () => {
  it("is always set in production, including when the app itself sees http", () => {
    const request = new Request("http://localhost:3000/api/auth/otp/verify");
    expect(secureCookie(request, "production")).toBe(true);
    expect(secureCookie(request, "development")).toBe(false);
  });
});
