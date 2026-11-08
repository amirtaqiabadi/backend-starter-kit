import { readString } from "@/server/http";
import { beginPaymentPost } from "@/server/payment/begin-post";
import { recoverPayment } from "@/server/payment/recover";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";

/** Why: recover reuses lock-and-verify so an unverified list cannot insert a credit by itself. */
export async function POST(request: Request) {
  const begun = await beginPaymentPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const authority = readString(begun.data.body, "authority");
  const result = await recoverPayment({
    userId: begun.data.session.userId,
    authority: authority || undefined,
  });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, result.data);
}
