import { NextResponse } from "next/server";
import { paymentMessages } from "@/domain/payment/messages";
import { requireSession } from "@/server/auth/require-session";
import type { SessionRecord } from "@/server/auth/session";
import { csrfMatches } from "@/server/csrf";
import { clientMeta, isSameOrigin, readJsonObject, requestTraceId, type ClientMeta } from "@/server/http";
import { paymentFailureResponse } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";

export type BegunPaymentPost = {
  body: Record<string, unknown>;
  client: ClientMeta;
  session: SessionRecord;
  traceId: string;
};

/** Why: wallet POSTs share origin, CSRF, session, and JSON-object checks before any money moves. */
export async function beginPaymentPost(
  request: Request,
): Promise<{ ok: true; data: BegunPaymentPost } | { ok: false; response: NextResponse }> {
  const traceId = requestTraceId(request);
  if (!isSameOrigin(request)) {
    return jsonFail({
      request,
      traceId,
      failure: paymentFail({
        status: 403,
        type: "DOMAIN_ERROR",
        code: "FORBIDDEN_ORIGIN",
        message: paymentMessages.forbiddenOrigin,
      }),
    });
  }
  if (!csrfMatches(request)) {
    return jsonFail({
      request,
      traceId,
      failure: paymentFail({
        status: 403,
        type: "DOMAIN_ERROR",
        code: "INVALID_CSRF",
        message: paymentMessages.invalidCsrf,
      }),
    });
  }
  const session = await requireSession(request);
  if (!session) {
    return jsonFail({
      request,
      traceId,
      failure: paymentFail({
        status: 401,
        type: "DOMAIN_ERROR",
        code: "UNAUTHORIZED",
        message: paymentMessages.unauthorized,
      }),
    });
  }
  const body = await readJsonObject(request);
  if (!body) {
    return jsonFail({
      request,
      traceId,
      failure: paymentFail({
        status: 400,
        type: "VALIDATION_ERROR",
        code: "INVALID_BODY",
        message: paymentMessages.invalidBody,
      }),
    });
  }
  return { ok: true, data: { body, client: clientMeta(request), session, traceId } };
}

function jsonFail(input: { request: Request; traceId: string; failure: ReturnType<typeof paymentFail> }) {
  return {
    ok: false as const,
    response: paymentFailureResponse(input.failure, input.traceId, input.request),
  };
}
