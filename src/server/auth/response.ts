import { NextResponse } from "next/server";
import { authConfig } from "@/server/config";
import type { AuthFailure } from "@/server/auth/result";

/** Why: browsers need both a JSON body and the standard Retry-After header. */
export function failureResponse(failure: AuthFailure): NextResponse {
  const headers = new Headers();
  if (failure.retryAfter !== undefined) {
    headers.set("Retry-After", String(Math.max(1, failure.retryAfter)));
  }
  return NextResponse.json(
    {
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.attemptsRemaining !== undefined
          ? { attemptsRemaining: failure.attemptsRemaining }
          : {}),
        ...(failure.retryAfter !== undefined ? { retryAfter: failure.retryAfter } : {}),
      },
    },
    { status: failure.status, headers },
  );
}

/** Why: a new login must rotate the session id into an HttpOnly cookie. */
export function jsonWithSession(request: Request, body: unknown, sessionId: string): NextResponse {
  const config = authConfig();
  const response = NextResponse.json(body);
  response.cookies.set({
    name: config.sessionCookieName,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: config.sessionAbsoluteSeconds,
  });
  return response;
}
