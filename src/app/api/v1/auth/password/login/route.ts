import { safeNextPath } from "@/domain/redirect";
import { beginAuthPost } from "@/server/auth/begin-post";
import { loginWithPassword } from "@/server/auth/password-login";
import { failureResponse, jsonWithSession } from "@/server/auth/response";
import { readString } from "@/server/http";

/** Why: password login must issue a new session cookie only after the generic credential check. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const result = await loginWithPassword({
    phoneNumber: readString(begun.data.body, "phoneNumber"),
    password: readString(begun.data.body, "password"),
    client: begun.data.client,
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  const redirectTo = safeNextPath(readString(begun.data.body, "next", ""));
  return jsonWithSession(request, { redirectTo }, result.data.sessionId);
}
