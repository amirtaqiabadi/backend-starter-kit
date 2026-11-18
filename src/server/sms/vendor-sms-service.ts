import { normalizePhone } from "@/domain/phone";
import type { OtpChannel, SmsService } from "@/server/sms/sms-service";

/** Why: both IPPanel delivery methods use the same OTP and error handling. */
export class VendorSmsService implements SmsService {
  async sendOtp(phoneNumber: string, code: string, channel: OtpChannel = "sms"): Promise<void> {
    const phone = normalizePhone(phoneNumber);
    if (!phone) throw new Error("Invalid OTP recipient");
    const token = requiredEnv("IPPANEL_API_TOKEN");
    const recipients = [`+98${phone.slice(1)}`];
    const body = channel === "voice"
      ? { sending_type: "votp", message: code, params: { recipients } }
      : {
          sending_type: "pattern",
          from_number: requiredEnv("IPPANEL_FROM_NUMBER"),
          code: requiredEnv("IPPANEL_PATTERN_CODE"),
          recipients,
          params: { [process.env.IPPANEL_PATTERN_PARAM?.trim() || "code"]: code },
        };
    const response = await fetch("https://edge.ippanel.com/v1/api/send", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("IPPanel delivery failed");
    const result = await response.json();
    if (
      result?.meta?.status !== true ||
      !Array.isArray(result?.data?.message_outbox_ids) ||
      result.data.message_outbox_ids.length === 0
    ) {
      throw new Error("IPPanel delivery was not accepted");
    }
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for IPPanel delivery`);
  return value;
}
