import { ConsoleSmsService } from "@/server/sms/console-sms-service";
import type { SmsService } from "@/server/sms/sms-service";
import { VendorSmsService } from "@/server/sms/vendor-sms-service";

export type { SmsService };

let current = createSmsService();

/** Why: SMS_PROVIDER is the only switch between the console sender and a real gateway. */
export function createSmsService(provider = process.env.SMS_PROVIDER ?? "console"): SmsService {
  if (provider === "vendor") {
    return new VendorSmsService();
  }
  return new ConsoleSmsService();
}

/** Why: routes stay unaware of which sender is active. */
export function getSmsService(): SmsService {
  return current;
}

/** Why: tests replace only the sender and keep Redis and Postgres real. */
export function setSmsService(service: SmsService): void {
  current = service;
}
