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
  const params = new URL(request.url).searchParams;
  const page = parsePositiveInteger(params, "page", 1);
  const limit = parsePositiveInteger(params, "limit", 20);
  if (page === null || limit === null || limit > 100 || (page - 1) * limit > 2_147_483_647) {
    return paymentFailureResponse(
      paymentFail({ status: 400, type: "VALIDATION_ERROR", code: "INVALID_PAGINATION", message: "پارامترهای صفحه‌بندی نامعتبر هستند." }),
      begun.data.traceId,
      request,
    );
  }
  const result = await listTeamTransactions({ userId: begun.data.session.userId, teamId, page, limit });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, result.data);
}

function parsePositiveInteger(params: URLSearchParams, key: string, fallback: number): number | null {
  const values = params.getAll(key);
  if (values.length === 0) return fallback;
  if (values.length !== 1 || !/^[0-9]+$/.test(values[0])) return null;
  const value = Number(values[0]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
