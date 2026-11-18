import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VendorSmsService } from "./vendor-sms-service";
import { createSmsService } from "./index";

const accepted = { data: { message_outbox_ids: [1123594208] }, meta: { status: true } };

describe("IPPanel OTP delivery", () => {
  const fetchMock = vi.fn();
  const service = new VendorSmsService();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("IPPANEL_API_TOKEN", "test-token");
    vi.stubEnv("IPPANEL_FROM_NUMBER", "+983000505");
    vi.stubEnv("IPPANEL_PATTERN_CODE", "pattern-id");
    vi.stubEnv("IPPANEL_PATTERN_PARAM", "code");
    fetchMock.mockResolvedValue(Response.json(accepted));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("selects IPPanel using either provider name", () => {
    expect(createSmsService("ippanel")).toBeInstanceOf(VendorSmsService);
    expect(createSmsService("vendor")).toBeInstanceOf(VendorSmsService);
  });

  it("defaults to a pattern SMS and converts the phone to E.164", async () => {
    await service.sendOtp("09123456789", "01234");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://edge.ippanel.com/v1/api/send");
    expect(options).toMatchObject({
      method: "POST",
      headers: { Authorization: "test-token", "Content-Type": "application/json" },
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
    expect(JSON.parse(options.body)).toEqual({
      sending_type: "pattern", from_number: "+983000505", code: "pattern-id",
      recipients: ["+989123456789"], params: { code: "01234" },
    });
  });

  it("uses the configured pattern placeholder", async () => {
    vi.stubEnv("IPPANEL_PATTERN_PARAM", "otp");
    await service.sendOtp("09123456789", "12345", "sms");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).params).toEqual({ otp: "12345" });
  });

  it("sends VOTP without requiring SMS pattern configuration", async () => {
    vi.stubEnv("IPPANEL_FROM_NUMBER", "");
    vi.stubEnv("IPPANEL_PATTERN_CODE", "");
    await service.sendOtp("09123456789", "01234", "voice");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      sending_type: "votp", message: "01234", params: { recipients: ["+989123456789"] },
    });
  });

  it.each(["IPPANEL_API_TOKEN", "IPPANEL_FROM_NUMBER", "IPPANEL_PATTERN_CODE"])("fails before sending when %s is missing", async (name) => {
    vi.stubEnv(name, "");
    await expect(service.sendOtp("09123456789", "12345")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 422, 500])("rejects HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(Response.json({ meta: { status: false } }, { status }));
    await expect(service.sendOtp("09123456789", "12345")).rejects.toThrow();
  });

  it.each([
    { data: null, meta: { status: false } },
    { data: { message_outbox_ids: [] }, meta: { status: true } },
    {}, null,
  ])("rejects an unaccepted or malformed response %j", async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(service.sendOtp("09123456789", "12345", "voice")).rejects.toThrow();
  });

  it("propagates network and timeout failures", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    await expect(service.sendOtp("09123456789", "12345", "voice")).rejects.toThrow();
  });
});
