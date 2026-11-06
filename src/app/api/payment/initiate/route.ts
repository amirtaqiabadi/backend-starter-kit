import { readInteger } from "@/server/http";
import { beginPaymentPost } from "@/server/payment/begin-post";
import { initiatePayment } from "@/server/payment/initiate";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";

/** Why: the route only forwards session identity and the requested amount; the ledger owns the attempt. */
export async function POST(request: Request) {
  const begun = await beginPaymentPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const teamId = readInteger(begun.data.body, "teamId");
  const result = await initiatePayment({
    userId: begun.data.session.userId,
    amount: begun.data.body.amount,
    description: begun.data.body.description,
    teamId: teamId !== null && teamId > 0 ? teamId : null,
    ip: begun.data.client.ip,
  });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, result.data);
}
