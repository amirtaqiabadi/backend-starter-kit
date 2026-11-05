/** Why: a one-time code may leave the server only in an explicit non-production debug mode. */
export function canRevealOtp(
  env: { NODE_ENV?: string; SMS_DEV_LOG?: string } = process.env,
): boolean {
  return env.NODE_ENV !== "production" && env.SMS_DEV_LOG === "true";
}
