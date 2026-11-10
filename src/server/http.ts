export type ClientMeta = {
  ip: string;
  userAgent: string;
};

const DEV_FRONTEND_ORIGIN = "http://localhost:3001";

/** Why: state-changing auth calls must come from this site, or the configured frontend origin. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  if (isAllowedApiOrigin(origin)) {
    return true;
  }
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const requestHost = request.headers.get("host") ?? requestHostFromUrl(request.url);
  return originHost === requestHost;
}

/** Why: the browser on port 3001 calls this API on port 3000 and must be named explicitly. */
export function isAllowedApiOrigin(origin: string | null): boolean {
  if (!origin) {
    return false;
  }
  return allowedApiOrigins().includes(origin);
}

/** Why: local dev defaults to the frontend port; production lists origins only from the environment. */
export function allowedApiOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.FRONTEND_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (configured && configured.length > 0) {
    return configured;
  }
  if (env.NODE_ENV === "production") {
    return [];
  }
  return [DEV_FRONTEND_ORIGIN];
}

/** Why: credentialed browser calls from the frontend need an explicit allow-origin, never `*`. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedApiOrigin(origin) || !origin) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-csrf-token, x-request-id",
    Vary: "Origin",
  };
}

/** Why: rate limits need a stable client address even when the platform omits a proxy header. */
export function clientMeta(request: Request, fallbackIp = "unknown"): ClientMeta {
  return {
    ip: clientIp(request, fallbackIp),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 512),
  };
}

/** Why: handlers should fail fast on a body that is not a JSON object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Why: string fields from JSON must not be coerced from numbers or objects. */
export function readString(body: Record<string, unknown>, key: string, fallback = ""): string {
  const value = body[key];
  return typeof value === "string" ? value : fallback;
}

/** Why: integer JSON fields must stay whole numbers and not be parsed from strings with junk. */
export function readInteger(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

/** Why: payment errors need a stable id even when the client omitted x-request-id. */
export function requestTraceId(request: Request): string {
  const header = request.headers.get("x-request-id")?.trim();
  if (header) {
    return header.slice(0, 128);
  }
  return crypto.randomUUID();
}

/** Why: the cookie jar is read without a framework helper so tests can use a plain Request. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

/** Why: the caller can prepend X-Forwarded-For, so only hops added by a configured proxy count. */
export function resolveClientIp(input: {
  forwardedFor: string | null;
  trustedProxyCount?: number;
  fallback?: string;
}): string {
  const trustedHops = input.trustedProxyCount ?? 0;
  const fallback = input.fallback ?? "unknown";
  if (trustedHops <= 0) {
    return fallback;
  }
  const hops = forwardedHops(input.forwardedFor);
  if (hops.length < trustedHops) {
    return fallback;
  }
  return hops[hops.length - trustedHops] ?? fallback;
}

/** Why: production must mark cookies Secure even when TLS stops at a proxy in front of this process. */
export function secureCookie(request: Request, nodeEnv = process.env.NODE_ENV ?? "development"): boolean {
  if (nodeEnv === "production") {
    return true;
  }
  return new URL(request.url).protocol === "https:";
}

/** Why: rate-limit keys read one resolved address instead of raw proxy headers. */
function clientIp(request: Request, fallback: string): string {
  return resolveClientIp({
    forwardedFor: request.headers.get("x-forwarded-for"),
    trustedProxyCount: trustedProxyCount(),
    fallback,
  });
}

/** Why: zero means the process is reached directly and every forwarded header is caller-controlled. */
function trustedProxyCount(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.TRUSTED_PROXY_COUNT);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

/** Why: proxies append addresses, so empty slots from a trailing comma must not become an identity. */
function forwardedHops(header: string | null): string[] {
  if (!header) {
    return [];
  }
  return header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Why: some runtimes omit the Host header and only expose it on the request URL. */
function requestHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
