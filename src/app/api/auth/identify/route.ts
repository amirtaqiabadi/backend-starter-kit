import { identifyPhone } from "@/server/auth/identify";
import { beginAuthPost } from "@/server/auth/begin-post";
import { failureResponse } from "@/server/auth/response";
import { readString } from "@/server/http";

/** Why: the phone screen needs a single decision between password and OTP. */
export async function POST(request: Request) {
  const begun = await beginAuthPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const result = await identifyPhone({
    phoneNumber: readString(begun.data.body, "phoneNumber"),
    ip: begun.data.client.ip,
  });
  if (!result.ok) {
    return failureResponse(result);
  }
  return Response.json(result.data);
}
