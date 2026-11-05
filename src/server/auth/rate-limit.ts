import { authConfig } from "@/server/config";
import { getRedis } from "@/server/redis";

export type LimitDecision = { allowed: true } | { allowed: false; retryAfter: number };

const CONSUME_LIMITS = `
local n = #KEYS
for i = 1, n do
  local limit = tonumber(ARGV[i * 2 - 1])
  local current = tonumber(redis.call('GET', KEYS[i]) or '0')
  if current >= limit then
    local ttl = redis.call('TTL', KEYS[i])
    local window = tonumber(ARGV[i * 2])
    if ttl < 0 then ttl = window end
    return {0, ttl}
  end
end
for i = 1, n do
  local window = tonumber(ARGV[i * 2])
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then
    redis.call('EXPIRE', KEYS[i], window)
  end
end
return {1, 0}
`;

const LOCK_STATUS = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
if count >= limit then
  local ttl = redis.call('TTL', KEYS[1])
  if ttl < 0 then ttl = window end
  return {1, ttl}
end
return {0, 0}
`;

const RECORD_FAILURE = `
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local count = redis.call('INCR', KEYS[1])
if count == 1 or count >= limit then
  redis.call('EXPIRE', KEYS[1], window)
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then ttl = window end
return {count, ttl}
`;

type WindowLimit = { key: string; limit: number; windowSeconds: number };

/** Why: several windows must be accepted or rejected together so one counter cannot move alone. */
export async function consumeLimits(limits: WindowLimit[]): Promise<LimitDecision> {
  const keys = limits.map((limit) => limit.key);
  const args = limits.flatMap((limit) => [String(limit.limit), String(limit.windowSeconds)]);
  const [allowed, ttl] = (await getRedis().eval(
    CONSUME_LIMITS,
    keys.length,
    ...keys,
    ...args,
  )) as [number, number];
  if (Number(allowed) === 1) {
    return { allowed: true };
  }
  return { allowed: false, retryAfter: Math.max(1, Number(ttl)) };
}

/** Why: identify is cheap to abuse, so both the number and the IP have their own budget. */
export async function consumeIdentifyLimits(input: {
  phone: string;
  ip: string;
}): Promise<LimitDecision> {
  const config = authConfig();
  return consumeLimits([
    {
      key: `identify:rl:phone:${input.phone}`,
      limit: config.identifyPhoneLimit,
      windowSeconds: config.identifyPhoneWindowSeconds,
    },
    {
      key: `identify:rl:ip:${input.ip}`,
      limit: config.identifyIpLimit,
      windowSeconds: config.identifyIpWindowSeconds,
    },
  ]);
}

/** Why: OTP sending is the expensive path and needs hourly, daily, and per-IP caps. */
export async function consumeOtpRequestLimits(input: {
  phone: string;
  ip: string;
}): Promise<LimitDecision> {
  const config = authConfig();
  return consumeLimits([
    {
      key: `otp:rl:phone:h:${input.phone}`,
      limit: config.otpPhoneHourlyLimit,
      windowSeconds: 3600,
    },
    {
      key: `otp:rl:phone:d:${input.phone}`,
      limit: config.otpPhoneDailyLimit,
      windowSeconds: 86400,
    },
    {
      key: `otp:rl:ip:${input.ip}`,
      limit: config.otpIpHourlyLimit,
      windowSeconds: 3600,
    },
  ]);
}

/** Why: password guessing from one address must stop even when numbers keep changing. */
export async function consumeLoginIpLimit(ip: string): Promise<LimitDecision> {
  const config = authConfig();
  return consumeLimits([
    {
      key: `login:rl:ip:${ip}`,
      limit: config.loginIpLimit,
      windowSeconds: config.loginIpWindowSeconds,
    },
  ]);
}

/** Why: a locked number must be rejected before another password hash is checked. */
export async function phoneLockStatus(phone: string): Promise<LimitDecision> {
  const config = authConfig();
  const [locked, ttl] = (await getRedis().eval(
    LOCK_STATUS,
    1,
    `login:fail:${phone}`,
    String(config.loginFailLimit),
    String(config.loginFailWindowSeconds),
  )) as [number, number];
  if (Number(locked) === 1) {
    return { allowed: false, retryAfter: Math.max(1, Number(ttl)) };
  }
  return { allowed: true };
}

/** Why: the lock window should start from the attempt that crosses the threshold. */
export async function recordPasswordFailure(phone: string): Promise<void> {
  const config = authConfig();
  await getRedis().eval(
    RECORD_FAILURE,
    1,
    `login:fail:${phone}`,
    String(config.loginFailWindowSeconds),
    String(config.loginFailLimit),
  );
}

/** Why: a correct password should not leave earlier typos counting toward lockout. */
export async function clearPasswordFailures(phone: string): Promise<void> {
  await getRedis().del(`login:fail:${phone}`);
}
