import { messages } from "@/domain/messages";
import { safeNextPath } from "@/domain/redirect";
import { beginAuthPost } from "@/server/auth/begin-post";
import { verifyOtpLogin, type OtpPurpose } from "@/server/auth/otp-verify";
import { failureResponse, jsonWithSession } from "@/server/auth/response";
import { fail } from "@/server/auth/result";
import { readString } from "@/server/http";

/** Why: verifying a code always creates a full session, and a reset purpose also arms password replacement. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const purpose = readPurpose(begun.data.body.purpose);
  if (!purpose) {
    return failureResponse(fail({ status: 400, code: "INVALID_BODY", message: messages.invalidBody }));
  }
  const result = await verifyOtpLogin({
    phoneNumber: readString(begun.data.body, "phoneNumber"),
    code: readString(begun.data.body, "code"),
    purpose,
    client: begun.data.client,
    referralToken: readString(begun.data.body, "token"),
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  const redirectTo = safeNextPath(readString(begun.data.body, "next", ""));
  return jsonWithSession(
    request,
    { hasPassword: result.data.hasPassword, redirectTo },
    result.data.sessionId,
  );
}

/** Why: a missing purpose means a normal login, and any other value is rejected. */
function readPurpose(value: unknown): OtpPurpose | null {
  if (value === undefined || value === "LOGIN") {
    return "LOGIN";
  }
  if (value === "RESET_PASSWORD") {
    return "RESET_PASSWORD";
  }
  return null;
}
