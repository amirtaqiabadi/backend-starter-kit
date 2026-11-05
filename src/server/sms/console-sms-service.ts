import { maskPhone } from "@/domain/mask-phone";
import { canRevealOtp } from "@/domain/reveal-otp";
import type { SmsService } from "@/server/sms/sms-service";

/** Why: local development needs a sender that never calls a paid gateway. */
export class ConsoleSmsService implements SmsService {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const phone = maskPhone(phoneNumber);
    if (!canRevealOtp()) {
      console.info("otp_sent", { phone });
      return;
    }
    console.info("otp_dev", { phone, code });
  }
}
