import { maskPhone } from "@/domain/mask-phone";
import { canRevealOtp } from "@/domain/reveal-otp";
import type { OtpChannel, SmsService } from "@/server/sms/sms-service";

/** Why: local development needs a sender that never calls a paid gateway. */
export class ConsoleSmsService implements SmsService {
  async sendOtp(phoneNumber: string, code: string, channel: OtpChannel = "sms"): Promise<void> {
    const phone = maskPhone(phoneNumber);
    if (process.env.NODE_ENV === "production" || !canRevealOtp()) {
      console.info("otp_sent", { phone, channel });
      return;
    }
    console.info("otp_dev", { phone, code, channel });
  }
}
