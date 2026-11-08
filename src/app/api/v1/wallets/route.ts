import { beginPaymentGet } from "@/server/payment/begin-get";
import { beginPaymentPost } from "@/server/payment/begin-post";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";
import { createWallet, listWallets } from "@/server/payment/wallets";

/** Why: the list is the caller's active memberships and the balance of each team's latest ledger row. */
export async function GET(request: Request) {
  const begun = await beginPaymentGet(request);
  if (!begun.ok) {
    return begun.response;
  }
  const wallets = await listWallets(begun.data.session.userId);
  return paymentJson(request, { wallets });
}

/** Why: a new wallet is a new team whose creator is the owner. */
export async function POST(request: Request) {
  const begun = await beginPaymentPost(request);
  if (!begun.ok) {
    return begun.response;
  }
  const result = await createWallet({
    userId: begun.data.session.userId,
    displayName: begun.data.body.displayName,
  });
  if (!result.ok) {
    return paymentFailureResponse(result, begun.data.traceId, request);
  }
  return paymentJson(request, result.data, 201);
}
