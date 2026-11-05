import { describe, expect, it, vi } from "vitest";
import { canRevealOtp } from "@/domain/reveal-otp";
import { ConsoleSmsService } from "@/server/sms/console-sms-service";

describe("canRevealOtp", () => {
  it("reveals a code only outside production when the dev flag is on", () => {
    expect(canRevealOtp({ NODE_ENV: "development", SMS_DEV_LOG: "true" })).toBe(true);
    expect(canRevealOtp({ NODE_ENV: "production", SMS_DEV_LOG: "true" })).toBe(false);
    expect(canRevealOtp({ NODE_ENV: "development", SMS_DEV_LOG: "false" })).toBe(false);
  });

  it("does not log the code when reveal is disabled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleSmsService().sendOtp("09123456789", "12345");
    expect(info).toHaveBeenCalledWith("otp_sent", { phone: "0912***6789" });
    expect(JSON.stringify(info.mock.calls)).not.toContain("12345");
    info.mockRestore();
  });
});
