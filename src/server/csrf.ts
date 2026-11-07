import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { authConfig } from "@/server/config";
import { readCookie, secureCookie } from "@/server/http";

export const CSRF_COOKIE_NAME = "csrf-token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Why: double-submit CSRF needs a fresh secret that JS can copy into a header. */
export function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Why: SameSite=Strict keeps the token off cross-site navigations while JS still reads it. */
export function setCsrfCookie(response: NextResponse, request: Request, token = newCsrfToken()): void {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    sameSite: "strict",
    secure: secureCookie(request),
    path: "/",
    maxAge: authConfig().sessionAbsoluteSeconds,
  });
}

/** Why: cookie and header must match as equal-length bytes so a short token cannot skip the check. */
export function csrfMatches(request: Request): boolean {
  const cookie = readCookie(request, CSRF_COOKIE_NAME);
  const header = request.headers.get(CSRF_HEADER_NAME) ?? "";
  if (!cookie || !header) {
    return false;
  }
  const cookieBytes = Buffer.from(cookie);
  const headerBytes = Buffer.from(header);
  if (cookieBytes.length !== headerBytes.length) {
    return false;
  }
  return timingSafeEqual(cookieBytes, headerBytes);
}
