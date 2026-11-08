import { describe, expect, it } from "vitest";
import { resolveClientIp, secureCookie } from "@/server/http";

describe("resolveClientIp", () => {
  it("ignores forwarded headers until a proxy hop count is configured", () => {
    expect(
      resolveClientIp({
        forwardedFor: "203.0.113.5",
        trustedProxyCount: 0,
        fallback: "unknown",
      }),
    ).toBe("unknown");
  });

  it("uses the hop the trusted proxy appended, not the one the caller prepended", () => {
    expect(
      resolveClientIp({
        forwardedFor: "198.51.100.9, 203.0.113.5",
        trustedProxyCount: 1,
        fallback: "unknown",
      }),
    ).toBe("203.0.113.5");
  });

  it("keeps the fallback when the forwarded chain is shorter than the trusted hop count", () => {
    expect(
      resolveClientIp({
        forwardedFor: null,
        trustedProxyCount: 1,
        fallback: "unknown",
      }),
    ).toBe("unknown");
  });
});

describe("secureCookie", () => {
  it("is always set in production, including when the app itself sees http", () => {
    const request = new Request("http://localhost:3000/api/v1/auth/otp/verify");
    expect(secureCookie(request, "production")).toBe(true);
    expect(secureCookie(request, "development")).toBe(false);
  });
});
