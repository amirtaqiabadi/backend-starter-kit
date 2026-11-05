import { NextResponse } from "next/server";
import { beginAuthPost } from "@/server/auth/begin-post";
import { resetPassword } from "@/server/auth/password-reset";
import { failureResponse } from "@/server/auth/response";
import { authConfig } from "@/server/config";
import { readCookie, readString } from "@/server/http";

/** Why: replacing a password requires the one-time reset flag on the current session. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const result = await resetPassword({
    sessionId: readCookie(request, authConfig().sessionCookieName),
    password: readString(begun.data.body, "password"),
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  return NextResponse.json({ ok: true });
}
