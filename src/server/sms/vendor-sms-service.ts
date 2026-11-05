import { maskPhone } from "@/domain/mask-phone";
import type { SmsService } from "@/server/sms/sms-service";

/** Why: the vendor branch exists so production can switch providers without a second OTP flow. */
export class VendorSmsService implements SmsService {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    void code;
    throw new Error(`SMS vendor is not configured (${maskPhone(phoneNumber)})`);
  }
}
