import { NextResponse } from "next/server";
import { messages } from "@/domain/messages";
import { failureResponse } from "@/server/auth/response";
import { fail } from "@/server/auth/result";
import { clientMeta, isSameOrigin, readJsonObject, type ClientMeta } from "@/server/http";

export type BegunPost = {
  body: Record<string, unknown>;
  client: ClientMeta;
};

/** Why: every auth POST shares the origin check and JSON-object requirement. */
export async function beginAuthPost(
  request: Request,
): Promise<{ ok: true; data: BegunPost } | { ok: false; response: NextResponse }> {
  if (!isSameOrigin(request)) {
    return {
      ok: false,
      response: failureResponse(
        fail({ status: 403, code: "FORBIDDEN_ORIGIN", message: messages.forbiddenOrigin }),
      ),
    };
  }
  const body = await readJsonObject(request);
  if (!body) {
    return {
      ok: false,
      response: failureResponse(
        fail({ status: 400, code: "INVALID_BODY", message: messages.invalidBody }),
      ),
    };
  }
  return { ok: true, data: { body, client: clientMeta(request) } };
}
