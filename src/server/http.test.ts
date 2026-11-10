import { describe, expect, it } from "vitest";
import { allowedApiOrigins, isSameOrigin, resolveClientIp, secureCookie } from "@/server/http";

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

describe("isSameOrigin", () => {
  it("accepts the frontend on port 3001 outside production", () => {
    const request = new Request("http://localhost:3000/api/v1/auth/identify", {
      method: "POST",
      headers: { origin: "http://localhost:3001", host: "localhost:3000" },
    });
    expect(isSameOrigin(request)).toBe(true);
    expect(allowedApiOrigins({ NODE_ENV: "development" })).toEqual(["http://localhost:3001"]);
  });

  it("rejects another origin in production unless it is configured", () => {
    expect(allowedApiOrigins({ NODE_ENV: "production" })).toEqual([]);
    expect(
      allowedApiOrigins({ NODE_ENV: "production", FRONTEND_ORIGINS: "http://localhost:3001" }),
    ).toEqual(["http://localhost:3001"]);
  });
});

describe("secureCookie", () => {
  it("is always set in production, including when the app itself sees http", () => {
    const request = new Request("http://localhost:3000/api/v1/auth/otp/verify");
    expect(secureCookie(request, "production")).toBe(true);
    expect(secureCookie(request, "development")).toBe(false);
  });
});
