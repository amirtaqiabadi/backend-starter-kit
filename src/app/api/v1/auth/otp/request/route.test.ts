import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requestOtp } from "@/server/auth/otp-request";

vi.mock("@/server/auth/otp-request", () => ({
  requestOtp: vi.fn().mockResolvedValue({
    ok: true,
    data: { cooldownSeconds: 120, code: "12345" },
  }),
}));

describe("OTP request response", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it.each([undefined, "sms", "voice"])("passes channel %s to OTP delivery", async (channel) => {
    const response = await POST(new Request("https://backend.example/api/v1/auth/otp/request", {
      method: "POST",
      headers: { origin: "https://backend.example", "content-type": "application/json" },
      body: JSON.stringify({ phoneNumber: "09123456789", channel }),
    }));
    expect(response.status).toBe(200);
    expect(requestOtp).toHaveBeenCalledWith(expect.objectContaining({ channel: channel ?? "sms" }));
  });

  it.each([null, "", "votp", "SMS", 1, false, [], {}])("rejects invalid channel %j before delivery", async (channel) => {
    const response = await POST(new Request("https://backend.example/api/v1/auth/otp/request", {
      method: "POST",
      headers: { origin: "https://backend.example", "content-type": "application/json" },
      body: JSON.stringify({ phoneNumber: "09123456789", channel }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_OTP_CHANNEL" } });
    expect(requestOtp).not.toHaveBeenCalled();
  });

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

  it.each(["ippanel", "vendor"])("omits devCode for %s even when staging and dev flags enable exposure", async (provider) => {
    vi.stubEnv("SMS_PROVIDER", provider);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("OTP_EXPOSE_CODE", "true");
    vi.stubEnv("SMS_DEV_LOG", "true");
    const response = await POST(new Request("https://backend.example/api/v1/auth/otp/request", {
      method: "POST",
      headers: { origin: "https://backend.example", "content-type": "application/json" },
      body: JSON.stringify({ phoneNumber: "09123456789" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cooldownSeconds: 120 });
  });
});
