export type PaymentConfig = {
  merchantId: string;
  sandbox: boolean;
  hmacSecret: string;
  callbackBaseUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  initiateUserLimit: number;
  initiateUserWindowSeconds: number;
  initiateIpLimit: number;
  initiateIpWindowSeconds: number;
  callbackIpLimit: number;
  callbackIpWindowSeconds: number;
  gatewayTimeoutMs: number;
};

/** Why: production must fail fast on missing merchant, HMAC, or callback origin instead of talking to the wrong host. */
export function paymentConfig(env: NodeJS.ProcessEnv = process.env): PaymentConfig {
  const production = env.NODE_ENV === "production";
  const sandboxRaw = env.ZARINPAL_SANDBOX;
  if (production && sandboxRaw !== "true" && sandboxRaw !== "false") {
    throw new Error("ZARINPAL_SANDBOX must be exactly true or false in production");
  }
  const sandbox = sandboxRaw !== "false";
  const merchantId = env.ZARINPAL_MERCHANT_ID?.trim() ?? "";
  const hmacSecret = env.PAYMENT_CALLBACK_HMAC_SECRET ?? "";
  const callbackBaseUrl = trimSlash(env.PAYMENT_CALLBACK_BASE_URL ?? "");
  if (production) {
    requireValue("ZARINPAL_MERCHANT_ID", merchantId);
    requireHmac(hmacSecret);
    requireValue("PAYMENT_CALLBACK_BASE_URL", callbackBaseUrl);
  }
  const base = callbackBaseUrl || "http://localhost:3000";
  return {
    merchantId,
    sandbox,
    hmacSecret,
    callbackBaseUrl: base,
    successRedirectUrl: env.PAYMENT_SUCCESS_REDIRECT_URL?.trim() || `${base}/docs?payment=ok`,
    failureRedirectUrl: env.PAYMENT_FAILURE_REDIRECT_URL?.trim() || `${base}/docs?payment=failed`,
    initiateUserLimit: intEnv(env, "PAYMENT_INITIATE_USER_LIMIT", 10),
    initiateUserWindowSeconds: intEnv(env, "PAYMENT_INITIATE_USER_WINDOW_SECONDS", 600),
    initiateIpLimit: intEnv(env, "PAYMENT_INITIATE_IP_LIMIT", 20),
    initiateIpWindowSeconds: intEnv(env, "PAYMENT_INITIATE_IP_WINDOW_SECONDS", 600),
    callbackIpLimit: intEnv(env, "PAYMENT_CALLBACK_IP_LIMIT", 30),
    callbackIpWindowSeconds: intEnv(env, "PAYMENT_CALLBACK_IP_WINDOW_SECONDS", 600),
    gatewayTimeoutMs: intEnv(env, "ZARINPAL_TIMEOUT_MS", 15_000),
  };
}

/** Why: sandbox and live use the same paths; only the host changes. */
export function zarinpalHost(sandbox = paymentConfig().sandbox): string {
  return sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
}

function requireValue(name: string, value: string): void {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

function requireHmac(secret: string): void {
  if (secret.length < 32) {
    throw new Error("PAYMENT_CALLBACK_HMAC_SECRET must be at least 32 characters");
  }
}

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

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
