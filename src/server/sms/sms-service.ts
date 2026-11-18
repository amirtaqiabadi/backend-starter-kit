export type OtpChannel = "sms" | "voice";

export interface SmsService {
  sendOtp(phoneNumber: string, code: string, channel?: OtpChannel): Promise<void>;
}
