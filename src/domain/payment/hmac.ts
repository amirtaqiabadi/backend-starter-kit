import { createHmac, timingSafeEqual } from "node:crypto";
import { amountDigits } from "@/domain/payment/amount";

/** Why: the callback signature is bound to the locked attempt, not to query values the client can edit. */
export function callbackHmacPayload(input: {
  attemptId: number;
  amount: bigint;
  salt: string;
}): string {
  return `${input.attemptId}:${amountDigits(input.amount)}:${input.salt}`;
}

/** Why: Base64 digest is what we put on callback_url as sig. */
export function signCallbackHmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

/** Why: a mismatched length must reject before timingSafeEqual throws. */
export function callbackHmacMatches(input: {
  secret: string;
  payload: string;
  signature: string;
}): boolean {
  if (!input.signature) {
    return false;
  }
  const expected = createHmac("sha256", input.secret).update(input.payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(input.signature, "base64");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
