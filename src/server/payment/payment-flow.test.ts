import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as requestOtpRoute } from "@/app/api/auth/otp/request/route";
import { POST as verifyOtpRoute } from "@/app/api/auth/otp/verify/route";
import { GET as callbackRoute } from "@/app/api/payment/callback/zarinpal/route";
import { POST as initiateRoute } from "@/app/api/payment/initiate/route";
import { POST as recoverRoute } from "@/app/api/payment/recover/route";
import { GET as listRefundsRoute, POST as createRefundRoute } from "@/app/api/payment/refunds/route";
import { POST as reverseRoute } from "@/app/api/payment/reverse/route";
import { GET as listWalletsRoute, POST as createWalletRoute } from "@/app/api/wallets/route";
import { GET as listTransactionsRoute } from "@/app/api/wallets/[teamId]/transactions/route";
import { callbackHmacPayload, signCallbackHmac } from "@/domain/payment/hmac";
import { getPrisma } from "@/server/db";
import { getRedis } from "@/server/redis";
import { setSmsService, type SmsService } from "@/server/sms";
import { deleteAllPaymentRows } from "@/server/payment/clear-tables";
import { paymentConfig } from "@/server/payment/config";
import { resetZarinpalTransport, setZarinpalTransport } from "@/server/payment/zarinpal";

const ORIGIN = "http://localhost:3000";
const HMAC_SECRET = paymentConfig().hmacSecret;
const AUTHORITY = "S0000000000000000000000000000001";

class MockSms implements SmsService {
  codes: string[] = [];

  /** Why: tests must see the issued code without a real SMS gateway. */
  async sendOtp(_phoneNumber: string, code: string): Promise<void> {
    this.codes.push(code);
  }
}

const sms = new MockSms();

type GatewayHandler = (url: string, body: unknown) => unknown;

let gateway: GatewayHandler = sandboxGateway();
const gatewayCalls: string[] = [];

describe("zarinpal wallet flow", () => {
  beforeEach(async () => {
    sms.codes = [];
    setSmsService(sms);
    gateway = sandboxGateway();
    gatewayCalls.length = 0;
    setZarinpalTransport(async (url, body) => {
      gatewayCalls.push(url);
      return gateway(url, body);
    });
    await getRedis().flushdb();
    await deleteAllPaymentRows();
    await getPrisma().authEvent.deleteMany();
    await getPrisma().user.deleteMany();
  });

  afterEach(() => {
    resetZarinpalTransport();
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
    await getRedis().quit();
  });

  it("credits once, rejects a second callback, and masks a refund card", async () => {
    const auth = await register("09120000021");
    const created = await createWalletRoute(paymentPost("/api/wallets", { displayName: "Travel" }, auth));
    expect(created.status).toBe(201);
    const wallet = (await created.json()) as { teamId: number };

    const started = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 5000, description: "شارژ", teamId: wallet.teamId }, auth),
    );
    expect(started.status).toBe(200);
    const initiated = (await started.json()) as { paymentUrl: string; attemptId: number };
    expect(initiated.paymentUrl).toContain("/pg/StartPay/S");

    const attempt = await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } });
    const ok = await callbackRoute(callbackRequest("OK", attempt.id, attempt.amount, attempt.salt ?? "", AUTHORITY));
    expect(ok.status).toBeGreaterThanOrEqual(300);
    expect(ok.status).toBeLessThan(400);
    expect(ok.headers.get("location")).toContain("payment=ok");

    const wallets = await listWalletsRoute(sessionGet("/api/wallets", auth.session));
    const listed = (await wallets.json()) as { wallets: Array<{ availableBalance: number }> };
    expect(listed.wallets[0]?.availableBalance).toBe(5000);

    const again = await callbackRoute(callbackRequest("OK", attempt.id, attempt.amount, attempt.salt ?? "", AUTHORITY));
    expect(again.status).toBeGreaterThanOrEqual(300);
    const afterSecond = await getPrisma().transaction.count({ where: { type: "GatewayCredit" } });
    expect(afterSecond).toBe(1);

    const history = await listTransactionsRoute(sessionGet(`/api/wallets/${wallet.teamId}/transactions`, auth.session), {
      params: Promise.resolve({ teamId: String(wallet.teamId) }),
    });
    const rows = (await history.json()) as { transactions: Array<{ id: number; type: string }> };
    const creditId = rows.transactions[0]?.id ?? 0;
    const refunded = await createRefundRoute(
      paymentPost("/api/payment/refunds", { transactionId: creditId, cardNumber: "5022291234565995" }, auth),
    );
    expect(refunded.status).toBe(201);
    const refundBody = (await refunded.json()) as { cardNumber: string };
    expect(refundBody.cardNumber).toBe("502229******5995");

    const listedRefunds = await listRefundsRoute(sessionGet(`/api/payment/refunds?teamId=${wallet.teamId}`, auth.session));
    const refundList = (await listedRefunds.json()) as { refunds: Array<{ cardNumber: string }> };
    expect(refundList.refunds[0]?.cardNumber).toBe("502229******5995");
  });

  it("does not verify or credit a NOK callback", async () => {
    const auth = await register("09120000022");
    const started = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 1000, description: "شارژ" }, auth),
    );
    const initiated = (await started.json()) as { attemptId: number };
    const attempt = await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } });
    gatewayCalls.length = 0;
    const nok = await callbackRoute(callbackRequest("NOK", attempt.id, attempt.amount, attempt.salt ?? "", AUTHORITY));
    expect(nok.headers.get("location")).toContain("PAYMENT_NOT_VERIFIED");
    expect(gatewayCalls.some((url) => url.includes("verify.json"))).toBe(false);
    expect(await getPrisma().transaction.count()).toBe(0);
    const failed = await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(failed.status).toBe("failed");
  });

  it("rolls back reverse when the gateway rejects, then reverses on success", async () => {
    const auth = await register("09120000023");
    const started = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 2000, description: "شارژ" }, auth),
    );
    const initiated = (await started.json()) as { attemptId: number };
    const attempt = await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } });
    await callbackRoute(callbackRequest("OK", attempt.id, attempt.amount, attempt.salt ?? "", AUTHORITY));

    gateway = sandboxGateway({ reverse: { data: {}, errors: { code: -60 } } });
    const rejected = await reverseRoute(paymentPost("/api/payment/reverse", { attemptId: initiated.attemptId }, auth));
    expect(rejected.status).toBe(502);
    expect(await getPrisma().transaction.count({ where: { type: "Reverse" } })).toBe(0);

    gateway = sandboxGateway({ reverse: { data: { code: 100, message: "Reversed" }, errors: [] } });
    const reversed = await reverseRoute(paymentPost("/api/payment/reverse", { attemptId: initiated.attemptId }, auth));
    expect(reversed.status).toBe(200);
    const wallets = await listWalletsRoute(sessionGet("/api/wallets", auth.session));
    const listed = (await wallets.json()) as { wallets: Array<{ availableBalance: number }> };
    expect(listed.wallets[0]?.availableBalance).toBe(0);
  });

  it("forbids charging a wallet the caller does not own", async () => {
    const owner = await register("09120000024");
    const created = await createWalletRoute(paymentPost("/api/wallets", { displayName: "Owner" }, owner));
    const wallet = (await created.json()) as { teamId: number };
    const other = await register("09120000025");
    const forbidden = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 1000, description: "شارژ", teamId: wallet.teamId }, other),
    );
    expect(forbidden.status).toBe(403);
    const body = (await forbidden.json()) as { error: { code: string } };
    expect(body.error.code).toBe("TEAM_FORBIDDEN");
  });

  it("recovers a paid attempt that missed the callback", async () => {
    const auth = await register("09120000026");
    const started = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 3000, description: "شارژ" }, auth),
    );
    const initiated = (await started.json()) as { attemptId: number };
    const recovered = await recoverRoute(paymentPost("/api/payment/recover", { authority: AUTHORITY }, auth));
    expect(recovered.status).toBe(200);
    const body = (await recovered.json()) as { recovered: number };
    expect(body.recovered).toBe(1);
    expect(await getPrisma().transaction.count({ where: { gatewayAttemptId: initiated.attemptId } })).toBe(1);
  });

  it("retries a reverse that timed out and rejects refunds after reverse", async () => {
    const auth = await register("09120000027");
    const started = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 4000, description: "شارژ" }, auth),
    );
    const initiated = (await started.json()) as { attemptId: number };
    const attempt = await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } });
    await callbackRoute(callbackRequest("OK", attempt.id, attempt.amount, attempt.salt ?? "", AUTHORITY));

    let reverseCalls = 0;
    gateway = (url, body) => {
      if (url.endsWith("reverse.json")) {
        reverseCalls += 1;
        if (reverseCalls === 1) {
          throw new Error("timeout");
        }
        return { data: { code: 100, message: "Reversed" }, errors: [] };
      }
      return sandboxGateway()(url, body);
    };
    const pending = await reverseRoute(paymentPost("/api/payment/reverse", { attemptId: initiated.attemptId }, auth));
    expect(pending.status).toBe(200);
    expect((await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } })).status).toBe(
      "reverse_pending",
    );

    const retried = await reverseRoute(paymentPost("/api/payment/reverse", { attemptId: initiated.attemptId }, auth));
    expect(retried.status).toBe(200);
    expect((await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } })).status).toBe(
      "reversed",
    );

    const credit = await getPrisma().transaction.findFirstOrThrow({
      where: { gatewayAttemptId: initiated.attemptId, type: "GatewayCredit" },
    });
    const refunded = await createRefundRoute(
      paymentPost("/api/payment/refunds", { transactionId: credit.id, cardNumber: "5022291234565995" }, auth),
    );
    expect(refunded.status).toBe(409);
  });

  it("stores an encrypted refund PAN, not the 16 digits", async () => {
    const auth = await register("09120000028");
    const started = await initiateRoute(
      paymentPost("/api/payment/initiate", { amount: 1000, description: "شارژ" }, auth),
    );
    const initiated = (await started.json()) as { attemptId: number };
    const attempt = await getPrisma().gatewayAttempt.findUniqueOrThrow({ where: { id: initiated.attemptId } });
    await callbackRoute(callbackRequest("OK", attempt.id, attempt.amount, attempt.salt ?? "", AUTHORITY));
    const credit = await getPrisma().transaction.findFirstOrThrow({
      where: { gatewayAttemptId: initiated.attemptId, type: "GatewayCredit" },
    });
    const refunded = await createRefundRoute(
      paymentPost("/api/payment/refunds", { transactionId: credit.id, cardNumber: "5022291234565995" }, auth),
    );
    expect(refunded.status).toBe(201);
    const stored = await getPrisma().refundRequest.findFirstOrThrow({ where: { transactionId: credit.id } });
    expect(stored.cardNumber).not.toBe("5022291234565995");
    expect(stored.cardNumber.startsWith("enc:v1:")).toBe(true);
    const listed = (await refunded.json()) as { cardNumber: string };
    expect(listed.cardNumber).toBe("502229******5995");
  });
});

function sandboxGateway(overrides: { reverse?: unknown } = {}): GatewayHandler {
  return (url) => {
    if (url.endsWith("request.json")) {
      return { data: { code: 100, authority: AUTHORITY, fee: 0 }, errors: [] };
    }
    if (url.endsWith("verify.json")) {
      return {
        data: {
          code: 100,
          ref_id: 99,
          card_pan: "502229******5995",
          card_hash: "abc",
          fee: 0,
        },
        errors: [],
      };
    }
    if (url.endsWith("reverse.json")) {
      return overrides.reverse ?? { data: { code: 100, message: "Reversed" }, errors: [] };
    }
    return { data: {}, errors: [] };
  };
}

function paymentPost(path: string, body: unknown, auth: AuthCookies): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      cookie: `session=${auth.session}; csrf-token=${auth.csrf}`,
      "x-csrf-token": auth.csrf,
    },
    body: JSON.stringify(body),
  });
}

function sessionGet(path: string, sessionId: string): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "GET",
    headers: { cookie: `session=${sessionId}` },
  });
}

function callbackRequest(status: string, attemptId: number, amount: bigint, salt: string, authority: string): Request {
  const sig = signCallbackHmac(HMAC_SECRET, callbackHmacPayload({ attemptId, amount, salt }));
  const url = `${ORIGIN}/api/payment/callback/zarinpal?sig=${encodeURIComponent(sig)}&Authority=${authority}&Status=${status}`;
  return new Request(url, { method: "GET" });
}

type AuthCookies = { session: string; csrf: string };

/** Why: wallet POSTs need both the session cookie and the CSRF pair issued at login. */
async function register(phone: string): Promise<AuthCookies> {
  await getRedis().del(`otp:cooldown:${phone}`);
  await requestOtpRoute(
    new Request(`${ORIGIN}/api/auth/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ phoneNumber: phone }),
    }),
  );
  const code = sms.codes.at(-1) ?? "";
  const verified = await verifyOtpRoute(
    new Request(`${ORIGIN}/api/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ phoneNumber: phone, code }),
    }),
  );
  return {
    session: cookieValue(verified, "session"),
    csrf: cookieValue(verified, "csrf-token"),
  };
}

function cookieValue(response: Response, name: string): string {
  const match = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
  if (!match) {
    throw new Error(`missing ${name} cookie`);
  }
  const pair = match.split(";")[0] ?? "";
  return decodeURIComponent(pair.slice(name.length + 1));
}
