import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME, setCsrfCookie } from "@/server/csrf";
import { readCookie } from "@/server/http";
import type { PaymentFailure } from "@/server/payment/result";

/** Why: Swagger and the frontend share type, code, message, and traceId on every payment failure. */
export function paymentFailureResponse(
  failure: PaymentFailure,
  traceId: string,
  request?: Request,
): NextResponse {
  const headers = new Headers();
  headers.set("x-request-id", traceId);
  if (failure.retryAfter !== undefined) {
    headers.set("Retry-After", String(Math.max(1, failure.retryAfter)));
  }
  const response = NextResponse.json(
    {
      error: {
        type: failure.type,
        code: failure.code,
        message: failure.message,
        traceId,
      },
    },
    { status: failure.status, headers },
  );
  if (request && !readCookie(request, CSRF_COOKIE_NAME)) {
    setCsrfCookie(response, request);
  }
  return response;
}

/** Why: authenticated GETs still mint a CSRF cookie so the next POST can send the header. */
export function paymentJson(request: Request, body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  if (!readCookie(request, CSRF_COOKIE_NAME)) {
    setCsrfCookie(response, request);
  }
  return response;
}
