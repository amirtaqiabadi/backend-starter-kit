export type AuthConfig = {
  otpTtlSeconds: number;
  otpCooldownSeconds: number;
  otpMaxAttempts: number;
  otpLength: number;
  otpPhoneHourlyLimit: number;
  otpPhoneDailyLimit: number;
  otpIpHourlyLimit: number;
  identifyPhoneLimit: number;
  identifyPhoneWindowSeconds: number;
  identifyIpLimit: number;
  identifyIpWindowSeconds: number;
  loginFailLimit: number;
  loginFailWindowSeconds: number;
  loginIpLimit: number;
  loginIpWindowSeconds: number;
  sessionSlidingSeconds: number;
  sessionAbsoluteSeconds: number;
  resetTtlSeconds: number;
  sessionCookieName: string;
};

/** Why: limits stay configurable, and tests must see the environment of the current process. */
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return {
    otpTtlSeconds: intEnv(env, "OTP_TTL_SECONDS", 180),
    otpCooldownSeconds: intEnv(env, "OTP_COOLDOWN_SECONDS", 120),
    otpMaxAttempts: intEnv(env, "OTP_MAX_ATTEMPTS", 3),
    otpLength: intEnv(env, "OTP_LENGTH", 5),
    otpPhoneHourlyLimit: intEnv(env, "OTP_PHONE_HOURLY_LIMIT", 5),
    otpPhoneDailyLimit: intEnv(env, "OTP_PHONE_DAILY_LIMIT", 10),
    otpIpHourlyLimit: intEnv(env, "OTP_IP_HOURLY_LIMIT", 20),
    identifyPhoneLimit: intEnv(env, "IDENTIFY_PHONE_LIMIT", 10),
    identifyPhoneWindowSeconds: intEnv(env, "IDENTIFY_PHONE_WINDOW_SECONDS", 600),
    identifyIpLimit: intEnv(env, "IDENTIFY_IP_LIMIT", 30),
    identifyIpWindowSeconds: intEnv(env, "IDENTIFY_IP_WINDOW_SECONDS", 600),
    loginFailLimit: intEnv(env, "LOGIN_FAIL_LIMIT", 5),
    loginFailWindowSeconds: intEnv(env, "LOGIN_FAIL_WINDOW_SECONDS", 900),
    loginIpLimit: intEnv(env, "LOGIN_IP_LIMIT", 20),
    loginIpWindowSeconds: intEnv(env, "LOGIN_IP_WINDOW_SECONDS", 900),
    sessionSlidingSeconds: intEnv(env, "SESSION_SLIDING_SECONDS", 2_592_000),
    sessionAbsoluteSeconds: intEnv(env, "SESSION_ABSOLUTE_SECONDS", 7_776_000),
    resetTtlSeconds: intEnv(env, "RESET_TTL_SECONDS", 600),
    sessionCookieName: env.SESSION_COOKIE_NAME || "session",
  };
}

/** Why: a missing or junk env value must fall back to the product default instead of NaN. */
function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
