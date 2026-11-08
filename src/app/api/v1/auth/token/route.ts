import { NextResponse } from "next/server";
import { messages } from "@/domain/messages";
import { requireSession } from "@/server/auth/require-session";
import { failureResponse } from "@/server/auth/response";
import { fail } from "@/server/auth/result";
import { readUserToken } from "@/server/auth/users";

/** Why: the signed-in user must be able to copy the token other people send at signup. */
export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) {
    return failureResponse(fail({ status: 401, code: "UNAUTHORIZED", message: messages.unauthorized }));
  }
  const token = await readUserToken(session.userId);
  if (!token) {
    return failureResponse(fail({ status: 401, code: "UNAUTHORIZED", message: messages.unauthorized }));
  }
  return NextResponse.json({ token });
}
