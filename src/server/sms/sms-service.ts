export interface SmsService {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}
