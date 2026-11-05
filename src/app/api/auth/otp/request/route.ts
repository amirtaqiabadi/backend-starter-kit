import { NextResponse } from "next/server";
import { canRevealOtp } from "@/domain/reveal-otp";
import { beginAuthPost } from "@/server/auth/begin-post";
import { requestOtp } from "@/server/auth/otp-request";
import { failureResponse } from "@/server/auth/response";
import { readString } from "@/server/http";
import { getSmsService } from "@/server/sms";

/** Why: requesting a code is the only place an SMS is sent, and the code stays off the response in production. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const result = await requestOtp({
    phoneNumber: readString(begun.data.body, "phoneNumber"),
    ip: begun.data.client.ip,
    userAgent: begun.data.client.userAgent,
    sms: getSmsService(),
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  return NextResponse.json({
    cooldownSeconds: result.data.cooldownSeconds,
    ...(canRevealOtp() ? { devCode: result.data.code } : {}),
  });
}
