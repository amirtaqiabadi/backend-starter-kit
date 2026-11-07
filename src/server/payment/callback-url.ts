import { callbackHmacPayload, signCallbackHmac } from "@/domain/payment/hmac";
import { paymentConfig } from "@/server/payment/config";

/** Why: the callback URL is built on the server after the attempt exists, never taken from the client. */
export function signedCallbackUrl(input: { attemptId: number; amount: bigint; salt: string }): string {
  const config = paymentConfig();
  const payload = callbackHmacPayload(input);
  const signature = signCallbackHmac(config.hmacSecret, payload);
  return `${config.callbackBaseUrl}/api/payment/callback/zarinpal?sig=${encodeURIComponent(signature)}`;
}
