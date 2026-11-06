import { paymentConfig, zarinpalHost } from "@/server/payment/config";

export type ZarinpalRequestResult =
  | { ok: true; authority: string; fee: bigint; code: number }
  | { ok: false; kind: "unavailable" | "rejected"; code?: number };

export type ZarinpalVerifyResult =
  | {
      ok: true;
      code: number;
      refId: string;
      cardPan: string;
      cardHash: string;
      fee: bigint;
      amount?: bigint;
    }
  | { ok: false; kind: "unavailable" | "rejected"; code?: number };

export type ZarinpalReverseResult =
  | { ok: true; code: number }
  | { ok: false; kind: "unavailable" | "rejected"; code?: number };

export type UnverifiedItem = { authority: string; amount: bigint };

type ZarinpalTransport = (url: string, body: unknown, timeoutMs: number) => Promise<unknown>;

let transport: ZarinpalTransport = postJson;

/** Why: tests replace only the HTTP call and keep ledger and HMAC real. */
export function setZarinpalTransport(next: ZarinpalTransport): void {
  transport = next;
}

/** Why: a test must not leak its mock into the next file. */
export function resetZarinpalTransport(): void {
  transport = postJson;
}

/** Why: payment request, StartPay, verify, and reverse must share one host. */
export function startPayUrl(authority: string, sandbox = paymentConfig().sandbox): string {
  return `${zarinpalHost(sandbox)}/pg/StartPay/${authority}`;
}

/** Why: auto_verify stays false so the panel cannot settle before this service verifies. */
export async function requestPayment(input: {
  amount: bigint;
  description: string;
  callbackUrl: string;
  mobile?: string;
}): Promise<ZarinpalRequestResult> {
  const config = paymentConfig();
  const payload: Record<string, unknown> = {
    merchant_id: config.merchantId,
    amount: Number(input.amount),
    currency: "IRR",
    description: input.description,
    callback_url: input.callbackUrl,
    metadata: {
      auto_verify: false,
      ...(input.mobile ? { mobile: input.mobile } : {}),
    },
  };
  const response = await call("/pg/v4/payment/request.json", payload);
  if (!response) {
    return { ok: false, kind: "unavailable" };
  }
  const code = gatewayCode(response);
  const authority = asString(nested(response, "data", "authority"));
  if (code !== 100 || !authority) {
    return { ok: false, kind: "rejected", code };
  }
  return { ok: true, authority, fee: asBigInt(nested(response, "data", "fee"), BigInt(0)), code };
}

/** Why: verify sends the stored amount, never a callback or fee-inclusive suggestion. */
export async function verifyPayment(input: {
  authority: string;
  amount: bigint;
}): Promise<ZarinpalVerifyResult> {
  const config = paymentConfig();
  const response = await call("/pg/v4/payment/verify.json", {
    merchant_id: config.merchantId,
    authority: input.authority,
    amount: Number(input.amount),
  });
  if (!response) {
    return { ok: false, kind: "unavailable" };
  }
  const code = gatewayCode(response);
  if (code === undefined) {
    return { ok: false, kind: "rejected" };
  }
  if (code !== 100 && code !== 101) {
    return { ok: false, kind: "rejected", code };
  }
  const amount = nested(response, "data", "amount");
  return {
    ok: true,
    code,
    refId: String(nested(response, "data", "ref_id") ?? ""),
    cardPan: asString(nested(response, "data", "card_pan")),
    cardHash: asString(nested(response, "data", "card_hash")),
    fee: asBigInt(nested(response, "data", "fee"), BigInt(0)),
    amount: amount === undefined ? undefined : asBigInt(amount, input.amount),
  };
}

/** Why: reverse body is merchant_id and authority only; ref_id must not be sent. */
export async function reversePayment(authority: string): Promise<ZarinpalReverseResult> {
  const config = paymentConfig();
  const response = await call("/pg/v4/payment/reverse.json", {
    merchant_id: config.merchantId,
    authority,
  });
  if (!response) {
    return { ok: false, kind: "unavailable" };
  }
  const code = gatewayCode(response);
  if (code === 100) {
    return { ok: true, code };
  }
  if (code === undefined) {
    return { ok: false, kind: "unavailable" };
  }
  return { ok: false, kind: "rejected", code };
}

/** Why: a missed callback is recovered by matching pending attempts, never by crediting this list. */
export async function listUnverified(): Promise<UnverifiedItem[] | null> {
  const config = paymentConfig();
  const response = await call("/pg/v4/payment/unVerified.json", { merchant_id: config.merchantId });
  if (!response) {
    return null;
  }
  const authorities = nested(response, "data", "authorities");
  if (!Array.isArray(authorities)) {
    return [];
  }
  return authorities.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const authority = asString(record.authority);
    if (!authority) {
      return [];
    }
    return [{ authority, amount: asBigInt(record.amount, BigInt(0)) }];
  });
}

async function call(path: string, body: unknown): Promise<unknown> {
  try {
    return await transport(`${zarinpalHost()}${path}`, body, paymentConfig().gatewayTimeoutMs);
  } catch {
    return null;
  }
}

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return response.json();
}

function gatewayCode(response: unknown): number | undefined {
  const dataCode = nested(response, "data", "code");
  if (typeof dataCode === "number") {
    return dataCode;
  }
  const errorCode = nested(response, "errors", "code");
  return typeof errorCode === "number" ? errorCode : undefined;
}

function nested(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBigInt(value: unknown, fallback: bigint): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  return fallback;
}
