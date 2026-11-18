/** Why: real delivery must never expose OTPs, even when staging enables test codes. */
export function canRevealOtp(
  env: { NODE_ENV?: string; SMS_PROVIDER?: string; SMS_DEV_LOG?: string; APP_ENV?: string; OTP_EXPOSE_CODE?: string } = process.env,
): boolean {
  if ((env.SMS_PROVIDER ?? "console") !== "console") {
    return false;
  }
  return (
    (env.APP_ENV === "staging" && env.OTP_EXPOSE_CODE === "true") ||
    (env.NODE_ENV !== "production" && env.SMS_DEV_LOG === "true")
  );
}
