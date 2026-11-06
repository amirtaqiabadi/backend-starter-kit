import { NextResponse } from "next/server";
import { paymentMessages } from "@/domain/payment/messages";
import { requireSession } from "@/server/auth/require-session";
import type { SessionRecord } from "@/server/auth/session";
import { requestTraceId } from "@/server/http";
import { paymentFailureResponse } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";

export type BegunPaymentGet = {
  session: SessionRecord;
  traceId: string;
};

/** Why: wallet reads still require a session, but they are not CSRF-protected. */
export async function beginPaymentGet(
  request: Request,
): Promise<{ ok: true; data: BegunPaymentGet } | { ok: false; response: NextResponse }> {
  const traceId = requestTraceId(request);
  const session = await requireSession(request);
  if (!session) {
    return {
      ok: false,
      response: paymentFailureResponse(
        paymentFail({
          status: 401,
          type: "DOMAIN_ERROR",
          code: "UNAUTHORIZED",
          message: paymentMessages.unauthorized,
        }),
        traceId,
        request,
      ),
    };
  }
  return { ok: true, data: { session, traceId } };
}
