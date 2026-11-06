import { NextResponse } from "next/server";
import { clientMeta, requestTraceId } from "@/server/http";
import { handleZarinpalCallback } from "@/server/payment/callback";
import { paymentConfig } from "@/server/payment/config";
import type { PaymentResult } from "@/server/payment/result";

/** Why: ZarinPal redirects the browser here with Authority and Status; HMAC is checked first. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await handleZarinpalCallback({
    sig: url.searchParams.get("sig") ?? "",
    authority: url.searchParams.get("Authority") ?? url.searchParams.get("authority") ?? "",
    status: url.searchParams.get("Status") ?? url.searchParams.get("status") ?? "",
    ip: clientMeta(request).ip,
  });
  return callbackRedirect(result, requestTraceId(request));
}

/** Why: the buyer lands on a host page with a stable code, never a stack or a PAN. */
function callbackRedirect(result: PaymentResult<{ attemptId: number }>, traceId: string): NextResponse {
  const config = paymentConfig();
  const target = new URL(result.ok ? config.successRedirectUrl : config.failureRedirectUrl);
  if (result.ok) {
    target.searchParams.set("attemptId", String(result.data.attemptId));
  } else {
    target.searchParams.set("code", result.code);
  }
  target.searchParams.set("traceId", traceId);
  return NextResponse.redirect(target);
}
