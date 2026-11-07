import { createHmac, randomInt } from "node:crypto";
import { authConfig } from "@/server/config";
import { getRedis } from "@/server/redis";

export type OtpVerifyResult =
  | { status: "OK" }
  | { status: "EXPIRED" }
  | { status: "EXHAUSTED" }
  | { status: "MISMATCH"; attemptsRemaining: number };

const STORE_OTP = `
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'code', ARGV[1], 'attempts', '0')
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
return 1
`;

const VERIFY_OTP = `
local data = redis.call('HMGET', KEYS[1], 'code', 'attempts')
if not data[1] then
  return {'EXPIRED', 0}
end
local attempts = tonumber(data[2]) or 0
local maxAttempts = tonumber(ARGV[2])
if data[1] == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return {'OK', 0}
end
attempts = attempts + 1
if attempts >= maxAttempts then
  redis.call('DEL', KEYS[1])
  return {'EXHAUSTED', 0}
end
redis.call('HSET', KEYS[1], 'attempts', tostring(attempts))
return {'MISMATCH', maxAttempts - attempts}
`;

/** Why: codes must come from a CSPRNG and keep a fixed width, including leading zeros. */
export function createOtpCode(length = authConfig().otpLength): string {
  const upper = 10 ** length;
  return randomInt(0, upper).toString().padStart(length, "0");
}

/** Why: a resend must replace the previous code and start the cooldown in one step. */
export async function storeOtp(input: { phone: string; code: string }): Promise<void> {
  const config = authConfig();
  await getRedis().eval(
    STORE_OTP,
    2,
    codeKey(input.phone),
    cooldownKey(input.phone),
    digestOtp(input.code),
    String(config.otpTtlSeconds),
    String(config.otpCooldownSeconds),
  );
}

/** Why: the client countdown has to follow the server cooldown, not a local guess. */
export async function otpCooldownTtl(phone: string): Promise<number> {
  const ttl = await getRedis().ttl(cooldownKey(phone));
  return ttl > 0 ? ttl : 0;
}

/** Why: a failed SMS must not leave the user waiting out a cooldown for a code that was never sent. */
export async function releaseOtp(phone: string): Promise<void> {
  await getRedis().del(codeKey(phone), cooldownKey(phone));
}

/** Why: existence, expiry, attempts, and single use have to change together or a code can be reused. */
export async function verifyOtp(input: { phone: string; code: string }): Promise<OtpVerifyResult> {
  const config = authConfig();
  const [status, remaining] = (await getRedis().eval(
    VERIFY_OTP,
    1,
    codeKey(input.phone),
    digestOtp(input.code),
    String(config.otpMaxAttempts),
  )) as [string, number];
  if (status === "OK") {
    return { status: "OK" };
  }
  if (status === "MISMATCH") {
    return { status: "MISMATCH", attemptsRemaining: Number(remaining) };
  }
  if (status === "EXHAUSTED") {
    return { status: "EXHAUSTED" };
  }
  return { status: "EXPIRED" };
}

const DEV_OTP_PEPPER = "dev-otp-pepper-not-for-production!!";

/** Why: Redis should not hold the digits a person can type into verify. */
function digestOtp(code: string): string {
  return createHmac("sha256", otpPepper()).update(code).digest("base64url");
}

/** Why: a short code is guessable offline unless the HMAC key stays out of Redis. */
function otpPepper(env: NodeJS.ProcessEnv = process.env): string {
  const pepper = env.OTP_PEPPER?.trim() ?? "";
  if (env.NODE_ENV === "production" && pepper.length < 32) {
    throw new Error("OTP_PEPPER must be at least 32 characters");
  }
  return pepper.length >= 32 ? pepper : DEV_OTP_PEPPER;
}

/** Why: callers should not rebuild Redis key names. */
function codeKey(phone: string): string {
  return `otp:code:${phone}`;
}

/** Why: the cooldown key is separate so a new code can expire on its own clock. */
function cooldownKey(phone: string): string {
  return `otp:cooldown:${phone}`;
}
