import { paymentMessages } from "@/domain/payment/messages";
import { readInteger } from "@/server/http";
import { beginPaymentPost } from "@/server/payment/begin-post";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";
import { reverseAttempt } from "@/server/payment/reverse";

/** Why: reverse is an authenticated owner action with CSRF, not an unauthenticated callback. */
export async function POST(request: Request) {
  const begun = await beginPaymentPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const attemptId = readInteger(begun.data.body, "attemptId");
  if (attemptId === null || attemptId <= 0) {
    return paymentFailureResponse(
      paymentFail({
        status: 400,
        type: "VALIDATION_ERROR",
        code: "INVALID_BODY",
        message: paymentMessages.invalidBody,
      }),
      begun.data.traceId,
      request,
    );
  }
  const result = await reverseAttempt({ userId: begun.data.session.userId, attemptId });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, result.data);
}
