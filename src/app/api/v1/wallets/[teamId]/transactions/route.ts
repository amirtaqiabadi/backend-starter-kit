import { paymentMessages } from "@/domain/payment/messages";
import { beginPaymentGet } from "@/server/payment/begin-get";
import { listTeamTransactions } from "@/server/payment/history";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";

/** Why: ledger history is scoped to one team the caller owns. */
export async function GET(request: Request, context: { params: Promise<{ teamId: string }> }) {
  const begun = await beginPaymentGet(request);
  if (!begun.ok) {
    return begun.response;
  }
  const { teamId: raw } = await context.params;
  const teamId = Number(raw);
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
  const result = await listTeamTransactions({ userId: begun.data.session.userId, teamId });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, { transactions: result.data });
}
