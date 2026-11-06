import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as identify } from "@/app/api/auth/identify/route";
import { POST as requestOtpRoute } from "@/app/api/auth/otp/request/route";
import { POST as verifyOtpRoute } from "@/app/api/auth/otp/verify/route";
import { POST as loginRoute } from "@/app/api/auth/password/login/route";
import { POST as resetRoute } from "@/app/api/auth/password/reset/route";
import { POST as setRoute } from "@/app/api/auth/password/set/route";
import { getPrisma } from "@/server/db";
import { getRedis } from "@/server/redis";
import { setSmsService, type SmsService } from "@/server/sms";
import { findOrCreateUserByPhone } from "@/server/auth/users";
import { deleteAllPaymentRows } from "@/server/payment/clear-tables";

const ORIGIN = "http://localhost:3000";

class MockSms implements SmsService {
  codes: string[] = [];
  fail = false;

  /** Why: tests must see the issued code without a real SMS gateway. */
  async sendOtp(_phoneNumber: string, code: string): Promise<void> {
    if (this.fail) {
      throw new Error("sms failed");
    }
    this.codes.push(code);
  }
}

const sms = new MockSms();

/** Why: route tests must look like a same-origin browser POST. */
function post(path: string, body: unknown, cookie = ""): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: ORIGIN,
  });
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Why: later calls need the session cookie the login response just set. */
function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((item) => item.startsWith("session="));
  if (!session) {
    throw new Error("missing session cookie");
  }
  return session.split(";")[0] ?? "";
}

/** Why: Redis assertions need the raw session id, not the whole cookie pair. */
function sessionId(response: Response): string {
  return decodeURIComponent(sessionCookie(response).slice("session=".length));
}

describe("phone auth flow", () => {
  beforeEach(async () => {
    sms.codes = [];
    sms.fail = false;
    setSmsService(sms);
    await getRedis().flushdb();
    await deleteAllPaymentRows();
    await getPrisma().authEvent.deleteMany();
    await getPrisma().user.deleteMany();
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
    await getRedis().quit();
  });

  it("chooses OTP when the number is new or has no password, and PASSWORD when it does", async () => {
    const fresh = await identify(post("/api/auth/identify", { phoneNumber: "09120000001" }));
    expect(await fresh.json()).toEqual({ nextStep: "OTP" });

    await register("09120000002");
    const noPassword = await identify(post("/api/auth/identify", { phoneNumber: "09120000002" }));
    expect(await noPassword.json()).toEqual({ nextStep: "OTP" });

    await setPassword("09120000003", "long-password");
    const withPassword = await identify(post("/api/auth/identify", { phoneNumber: "09120000003" }));
    expect(await withPassword.json()).toEqual({ nextStep: "PASSWORD" });
  });

  it("rate-limits identify", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await identify(post("/api/auth/identify", { phoneNumber: "09120000004" }));
      expect(response.status).toBe(200);
    }
    const blocked = await identify(post("/api/auth/identify", { phoneNumber: "09120000004" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("verifies a code once, counts mismatches, and rejects expiry, reuse, and replacement", async () => {
    const phone = "09120000005";
    const issued = await requestOtp(phone);
    const code = sms.codes[0] ?? "";
    expect(code).toMatch(/^\d{5}$/);
    const wrongCodes = ["11111", "22222", "33333", "44444"]
      .filter((candidate) => candidate !== code)
      .slice(0, 3);

    const wrong = await verifyOtpRoute(
      post("/api/auth/otp/verify", { phoneNumber: phone, code: wrongCodes[0] }),
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ error: { code: "OTP_MISMATCH", attemptsRemaining: 2 } });

    const second = await verifyOtpRoute(
      post("/api/auth/otp/verify", { phoneNumber: phone, code: wrongCodes[1] }),
    );
    expect(await second.json()).toMatchObject({ error: { attemptsRemaining: 1 } });

    const third = await verifyOtpRoute(
      post("/api/auth/otp/verify", { phoneNumber: phone, code: wrongCodes[2] }),
    );
    expect(await third.json()).toMatchObject({ error: { code: "OTP_EXHAUSTED" } });

    const afterExhausted = await verifyOtpRoute(
      post("/api/auth/otp/verify", { phoneNumber: phone, code }),
    );
    expect(await afterExhausted.json()).toMatchObject({ error: { code: "OTP_EXPIRED" } });

    await clearOtpLimits(phone);
    await requestOtp(phone);
    const current = sms.codes.at(-1) ?? "";
    await getRedis().pexpire(`otp:code:${phone}`, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const expired = await verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code: current }));
    expect(await expired.json()).toMatchObject({ error: { code: "OTP_EXPIRED" } });

    await clearOtpLimits(phone);
    await requestOtp(phone);
    const live = sms.codes.at(-1) ?? "";
    const persian = live.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
    const success = await verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code: persian }));
    expect(success.status).toBe(200);
    const reused = await verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code: live }));
    expect(reused.status).toBe(401);

    await clearOtpLimits(phone);
    await requestOtp(phone);
    const previous = sms.codes.at(-1) ?? "";
    await clearOtpLimits(phone);
    await requestOtp(phone);
    const latest = sms.codes.at(-1) ?? "";
    const stale = await verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code: previous }));
    expect(stale.status).toBe(401);
    const fresh = await verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code: latest }));
    expect(fresh.status).toBe(200);
    expect(issued.status).toBe(200);
  });

  it("enforces cooldown and hourly rate limits and releases cooldown when SMS fails", async () => {
    const phone = "09120000006";
    expect((await requestOtp(phone)).status).toBe(200);
    const cooled = await requestOtp(phone);
    expect(cooled.status).toBe(429);
    expect(await cooled.json()).toMatchObject({ error: { code: "OTP_COOLDOWN" } });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await getRedis().del(`otp:cooldown:${phone}`);
      expect((await requestOtp(phone)).status).toBe(200);
    }
    await getRedis().del(`otp:cooldown:${phone}`);
    const limited = await requestOtp(phone);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });

    const other = "09120000007";
    sms.fail = true;
    const failed = await requestOtp(other);
    expect(failed.status).toBe(503);
    expect(await getRedis().exists(`otp:cooldown:${other}`)).toBe(0);
    sms.fail = false;
    expect((await requestOtp(other)).status).toBe(200);
    const body = await requestOtp(other);
    expect(body.status).toBe(429);
  });

  it("lets one parallel verify win and creates a single user row", async () => {
    const phone = "09120000008";
    await requestOtp(phone);
    const code = sms.codes.at(-1) ?? "";
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code })),
      ),
    );
    expect(results.filter((response) => response.status === 200)).toHaveLength(1);
    expect(await getPrisma().user.count({ where: { phoneNumber: phone } })).toBe(1);

    const racedPhone = "09120000009";
    await Promise.all(Array.from({ length: 12 }, () => findOrCreateUserByPhone(racedPhone)));
    expect(await getPrisma().user.count({ where: { phoneNumber: racedPhone } })).toBe(1);
  });

  it("returns the same failure for a wrong password, an unknown user, and a user without a password", async () => {
    await setPassword("09120000010", "long-password");
    await register("09120000011");
    const wrong = await login("09120000010", "not-the-password");
    const unknown = await login("09120000012", "not-the-password");
    const noPassword = await login("09120000011", "not-the-password");
    const wrongBody = await wrong.json();
    const unknownBody = await unknown.json();
    const noPasswordBody = await noPassword.json();
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(noPassword.status).toBe(401);
    expect(unknownBody).toEqual(wrongBody);
    expect(noPasswordBody).toEqual(wrongBody);
  });

  it("locks password login after five failures", async () => {
    await setPassword("09120000013", "long-password");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login("09120000013", "not-the-password");
      expect(response.status).toBe(401);
    }
    const locked = await login("09120000013", "long-password");
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBeTruthy();
  });

  it("sets a password only once and only with a session", async () => {
    const missing = await setRoute(
      post("/api/auth/password/set", { password: "long-password" }),
    );
    expect(missing.status).toBe(401);

    const registered = await register("09120000014");
    const first = await setRoute(
      post("/api/auth/password/set", { password: "long-password" }, sessionCookie(registered)),
    );
    expect(first.status).toBe(200);
    const second = await setRoute(
      post("/api/auth/password/set", { password: "another-password" }, sessionCookie(registered)),
    );
    expect(second.status).toBe(409);
  });

  it("resets a password once, keeps the current session, and drops the others", async () => {
    const phone = "09120000015";
    const first = await setPassword(phone, "long-password");
    const second = await login(phone, "long-password");
    const third = await login(phone, "long-password");
    await getRedis().del(`otp:cooldown:${phone}`);
    await requestOtp(phone);
    const code = sms.codes.at(-1) ?? "";
    const resetLogin = await verifyOtpRoute(
      post("/api/auth/otp/verify", { phoneNumber: phone, code, purpose: "RESET_PASSWORD" }),
    );
    expect(resetLogin.status).toBe(200);

    const withoutFlag = await resetRoute(
      post("/api/auth/password/reset", { password: "replacement-1" }, sessionCookie(second)),
    );
    expect(withoutFlag.status).toBe(403);

    const reset = await resetRoute(
      post("/api/auth/password/reset", { password: "replacement-1" }, sessionCookie(resetLogin)),
    );
    expect(reset.status).toBe(200);
    expect(await getRedis().exists(`session:${sessionId(first)}`)).toBe(0);
    expect(await getRedis().exists(`session:${sessionId(second)}`)).toBe(0);
    expect(await getRedis().exists(`session:${sessionId(third)}`)).toBe(0);
    expect(await getRedis().exists(`session:${sessionId(resetLogin)}`)).toBe(1);

    const again = await resetRoute(
      post("/api/auth/password/reset", { password: "replacement-2" }, sessionCookie(resetLogin)),
    );
    expect(again.status).toBe(403);
    const signedIn = await login(phone, "replacement-1");
    expect(signedIn.status).toBe(200);
  });

  it("falls back when next is an open redirect", async () => {
    await setPassword("09120000016", "long-password");
    const protocolRelative = await login("09120000016", "long-password", "//evil.com");
    expect(await protocolRelative.json()).toMatchObject({ redirectTo: "/" });
    const absolute = await login("09120000016", "long-password", "https://evil.com");
    expect(await absolute.json()).toMatchObject({ redirectTo: "/" });
  });
});

/** Why: OTP semantics tests must not trip the hourly cap while they replace a code. */
async function clearOtpLimits(phone: string): Promise<void> {
  await getRedis().del(
    `otp:cooldown:${phone}`,
    `otp:rl:phone:h:${phone}`,
    `otp:rl:phone:d:${phone}`,
    "otp:rl:ip:unknown",
  );
}

/** Why: most cases start from a freshly issued OTP. */
async function requestOtp(phone: string): Promise<Response> {
  return requestOtpRoute(post("/api/auth/otp/request", { phoneNumber: phone }));
}

/** Why: registration in these tests is a successful OTP verify. */
async function register(phone: string): Promise<Response> {
  await getRedis().del(`otp:cooldown:${phone}`);
  await requestOtp(phone);
  const code = sms.codes.at(-1) ?? "";
  return verifyOtpRoute(post("/api/auth/otp/verify", { phoneNumber: phone, code }));
}

/** Why: password cases need an account that already has a hash. */
async function setPassword(phone: string, password: string): Promise<Response> {
  const registered = await register(phone);
  const response = await setRoute(
    post("/api/auth/password/set", { password }, sessionCookie(registered)),
  );
  if (response.status !== 200) {
    throw new Error(`set password failed: ${response.status}`);
  }
  return registered;
}

/** Why: login assertions share one request shape. */
async function login(phone: string, password: string, next = "/"): Promise<Response> {
  return loginRoute(post("/api/auth/password/login", { phoneNumber: phone, password, next }));
}
