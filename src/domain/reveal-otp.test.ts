import { afterEach, describe, expect, it, vi } from "vitest";
import { canRevealOtp } from "@/domain/reveal-otp";
import { ConsoleSmsService } from "@/server/sms/console-sms-service";

describe("canRevealOtp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reveals a code only outside production when the dev flag is on", () => {
    expect(canRevealOtp({ NODE_ENV: "development", SMS_DEV_LOG: "true" })).toBe(true);
    expect(canRevealOtp({ NODE_ENV: "production", SMS_DEV_LOG: "true" })).toBe(false);
    expect(canRevealOtp({ NODE_ENV: "development", SMS_DEV_LOG: "false" })).toBe(false);
  });

  it("requires both staging and the explicit response flag for a deployed build", () => {
    expect(canRevealOtp({ NODE_ENV: "production", APP_ENV: "staging", OTP_EXPOSE_CODE: "true" })).toBe(true);
    for (const APP_ENV of [undefined, "production", "development"]) {
      expect(canRevealOtp({ NODE_ENV: "production", APP_ENV, OTP_EXPOSE_CODE: "true", SMS_DEV_LOG: "true" })).toBe(false);
    }
    for (const OTP_EXPOSE_CODE of [undefined, "false", "TRUE"]) {
      expect(canRevealOtp({ NODE_ENV: "production", APP_ENV: "staging", OTP_EXPOSE_CODE })).toBe(false);
    }
  });

  it.each(["ippanel", "vendor"])("never reveals a code with real provider %s", (SMS_PROVIDER) => {
    expect(canRevealOtp({ SMS_PROVIDER, NODE_ENV: "production", APP_ENV: "staging", OTP_EXPOSE_CODE: "true" })).toBe(false);
    expect(canRevealOtp({ SMS_PROVIDER, NODE_ENV: "development", SMS_DEV_LOG: "true" })).toBe(false);
  });

  it("does not log the code when reveal is disabled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleSmsService().sendOtp("09123456789", "12345");
    expect(info).toHaveBeenCalledWith("otp_sent", { phone: "0912***6789", channel: "sms" });
    expect(JSON.stringify(info.mock.calls)).not.toContain("12345");
    info.mockRestore();
  });

  it("keeps codes out of staging logs even when the API exposes them", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("OTP_EXPOSE_CODE", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleSmsService().sendOtp("09123456789", "12345");
    expect(info).toHaveBeenCalledWith("otp_sent", { phone: "0912***6789", channel: "sms" });
    expect(JSON.stringify(info.mock.calls)).not.toContain("12345");
  });
});
