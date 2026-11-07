import { consumeLimits } from "@/server/auth/rate-limit";
import { paymentConfig } from "@/server/payment/config";

/** Why: starting payments is cheap to automate, so both the user and the IP share a budget. */
export async function consumeInitiateLimits(input: { userId: string; ip: string }) {
  const config = paymentConfig();
  return consumeLimits([
    {
      key: `payment:rl:initiate:user:${input.userId}`,
      limit: config.initiateUserLimit,
      windowSeconds: config.initiateUserWindowSeconds,
    },
    {
      key: `payment:rl:initiate:ip:${input.ip}`,
      limit: config.initiateIpLimit,
      windowSeconds: config.initiateIpWindowSeconds,
    },
  ]);
}

/** Why: the unauthenticated callback must not let one IP hammer verify. */
export async function consumeCallbackLimit(ip: string) {
  const config = paymentConfig();
  return consumeLimits([
    {
      key: `payment:rl:callback:ip:${ip}`,
      limit: config.callbackIpLimit,
      windowSeconds: config.callbackIpWindowSeconds,
    },
  ]);
}
