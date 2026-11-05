import { NextResponse } from "next/server";
import { beginAuthPost } from "@/server/auth/begin-post";
import { setPassword } from "@/server/auth/password-set";
import { failureResponse } from "@/server/auth/response";
import { authConfig } from "@/server/config";
import { readCookie, readString } from "@/server/http";

/** Why: setting a password is allowed only for the signed-in user who does not have one yet. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const result = await setPassword({
    sessionId: readCookie(request, authConfig().sessionCookieName),
    password: readString(begun.data.body, "password"),
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  return NextResponse.json({ ok: true });
}
