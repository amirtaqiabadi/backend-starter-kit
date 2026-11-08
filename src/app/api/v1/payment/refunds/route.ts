import { paymentMessages } from "@/domain/payment/messages";
import { readInteger } from "@/server/http";
import { beginPaymentGet } from "@/server/payment/begin-get";
import { beginPaymentPost } from "@/server/payment/begin-post";
import { createRefundRequest, listRefundRequests } from "@/server/payment/refund";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";

/** Why: listing refunds is owner-only and returns a masked card, never the stored PAN. */
export async function GET(request: Request) {
  const begun = await beginPaymentGet(request);
  if (!begun.ok) {
    return begun.response;
  }
  const teamId = Number(new URL(request.url).searchParams.get("teamId"));
  if (!Number.isInteger(teamId) || teamId <= 0) {
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
  const result = await listRefundRequests({ userId: begun.data.session.userId, teamId });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, { refunds: result.data });
}

/** Why: the request stores a destination card for later manual payout and does not call reverse. */
export async function POST(request: Request) {
  const begun = await beginPaymentPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const transactionId = readInteger(begun.data.body, "transactionId");
  if (transactionId === null || transactionId <= 0) {
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
  const result = await createRefundRequest({
    userId: begun.data.session.userId,
    transactionId,
    cardNumber: begun.data.body.cardNumber,
  });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, result.data, 201);
}
