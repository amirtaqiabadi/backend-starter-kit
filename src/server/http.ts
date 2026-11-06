export type ClientMeta = {
  ip: string;
  userAgent: string;
};

/** Why: state-changing auth calls must come from this site, not another origin. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
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

/** Why: the first forwarded hop is the client when a proxy is present. */
function clientIp(request: Request, fallback: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || fallback;
}

/** Why: some runtimes omit the Host header and only expose it on the request URL. */
function requestHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
