import { NextResponse } from "next/server";
import { messages } from "@/domain/messages";
import { canRevealOtp } from "@/domain/reveal-otp";
import { beginAuthPost } from "@/server/auth/begin-post";
import { requestOtp } from "@/server/auth/otp-request";
import { failureResponse } from "@/server/auth/response";
import { fail } from "@/server/auth/result";
import { readString } from "@/server/http";
import { getSmsService } from "@/server/sms";

/** Why: staging may explicitly return a test code while live deployments omit it. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const channel = begun.data.body.channel;
  if (channel !== undefined && channel !== "sms" && channel !== "voice") {
    return failureResponse(fail({
      status: 400,
      code: "INVALID_OTP_CHANNEL",
      message: messages.invalidOtpChannel,
    }));
  }
  const result = await requestOtp({
    phoneNumber: readString(begun.data.body, "phoneNumber"),
    ip: begun.data.client.ip,
    userAgent: begun.data.client.userAgent,
    sms: getSmsService(),
    channel: channel ?? "sms",
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  return NextResponse.json(
    {
      cooldownSeconds: result.data.cooldownSeconds,
      ...(canRevealOtp() ? { devCode: result.data.code } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
