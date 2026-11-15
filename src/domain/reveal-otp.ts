/** Why: deployed staging uses the production runtime but explicitly opts in to test codes. */
export function canRevealOtp(
  env: { NODE_ENV?: string; SMS_DEV_LOG?: string; APP_ENV?: string; OTP_EXPOSE_CODE?: string } = process.env,
): boolean {
  return (
    (env.APP_ENV === "staging" && env.OTP_EXPOSE_CODE === "true") ||
    (env.NODE_ENV !== "production" && env.SMS_DEV_LOG === "true")
  );
}
