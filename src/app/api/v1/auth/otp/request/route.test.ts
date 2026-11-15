import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/server/auth/otp-request", () => ({
  requestOtp: vi.fn().mockResolvedValue({
    ok: true,
    data: { cooldownSeconds: 120, code: "12345" },
  }),
}));

describe("OTP request response", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["staging", "true", true],
    ["staging", "false", false],
    ["production", "true", false],
  ])("handles APP_ENV=%s and OTP_EXPOSE_CODE=%s", async (environment, flag, exposed) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", environment);
    vi.stubEnv("OTP_EXPOSE_CODE", flag);
    const request = new Request("https://backend.example/api/v1/auth/otp/request", {
      method: "POST",
      headers: { origin: "https://backend.example", "content-type": "application/json" },
      body: JSON.stringify({ phoneNumber: "09123456789" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      cooldownSeconds: 120,
      ...(exposed ? { devCode: "12345" } : {}),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
