export const CALLBACK_OK = "OK";
export const VERIFY_FIRST_SUCCESS = 100;
export const VERIFY_ALREADY = 101;
export const VERIFY_AMOUNT_MISMATCH = -50;
export const REVERSE_SUCCESS = 100;
export const REVERSE_WINDOW_MINUTES = 30;

export const REVERSE_REJECTION_CODES = new Set([-60, -61, -62, -63]);

/** Why: NOK means the buyer cancelled or the bank failed, so verify must not run. */
export function shouldVerifyCallback(status: string): boolean {
  return status === CALLBACK_OK;
}

/** Why: code 100 is the first verify; 101 is already verified and must not credit twice. */
export function isVerifySuccessCode(code: number): boolean {
  return code === VERIFY_FIRST_SUCCESS || code === VERIFY_ALREADY;
}

/** Why: a successful attempt is reversed only inside the gateway's 30-minute window. */
export function isWithinReverseWindow(creditedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - creditedAt.getTime() < REVERSE_WINDOW_MINUTES * 60 * 1000;
}
