import { describe, expect, it } from "vitest";
import { callbackHmacMatches, callbackHmacPayload, signCallbackHmac } from "@/domain/payment/hmac";

describe("callback HMAC", () => {
  it("accepts the signature of the locked attempt and rejects a mutated amount", () => {
    const secret = "test-hmac-secret-must-be-32-chars-min";
    const payload = callbackHmacPayload({ attemptId: 7, amount: BigInt(1000), salt: "abc" });
    const signature = signCallbackHmac(secret, payload);
    expect(callbackHmacMatches({ secret, payload, signature })).toBe(true);
    const other = callbackHmacPayload({ attemptId: 7, amount: BigInt(2000), salt: "abc" });
    expect(callbackHmacMatches({ secret, payload: other, signature })).toBe(false);
  });

  it("rejects a truncated signature before comparing bytes", () => {
    expect(
      callbackHmacMatches({
        secret: "test-hmac-secret-must-be-32-chars-min",
        payload: "1:1000:salt",
        signature: "YQ==",
      }),
    ).toBe(false);
  });
});
