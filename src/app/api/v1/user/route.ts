import { readUserProfile } from "@/server/auth/users";
import { getPrisma } from "@/server/db";
import { beginPaymentGet } from "@/server/payment/begin-get";
import { beginPaymentPost } from "@/server/payment/begin-post";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";

/** Return only the current account's public profile and password status. */
export async function GET(request: Request) {
  const begun = await beginPaymentGet(request);
  if (!begun.ok) return begun.response;

  const user = await readUserProfile(begun.data.session.userId);
  if (!user) {
    return paymentFailureResponse(paymentFail({
      status: 401,
      type: "DOMAIN_ERROR",
      code: "UNAUTHORIZED",
      message: "برای ادامه باید وارد شوید.",
    }), begun.data.traceId, request);
  }
  const response = paymentJson(request, user);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Update only explicitly supported fields on the account identified by the session. */
export async function PATCH(request: Request) {
  const begun = await beginPaymentPost(request);
  if (!begun.ok) return begun.response;

  const { body, session, traceId } = begun.data;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (Object.keys(body).some((key) => key !== "name") || !name || name.length > 80) {
    return paymentFailureResponse(paymentFail({
      status: 400,
      type: "VALIDATION_ERROR",
      code: "INVALID_USER_PROFILE",
      message: "نام باید بین ۱ تا ۸۰ نویسه باشد و فیلد دیگری ارسال نشود.",
    }), traceId, request);
  }

  const updated = await getPrisma().user.updateMany({ where: { id: session.userId }, data: { name } });
  if (updated.count === 0) {
    return paymentFailureResponse(paymentFail({
      status: 401,
      type: "DOMAIN_ERROR",
      code: "UNAUTHORIZED",
      message: "برای ادامه باید وارد شوید.",
    }), traceId, request);
  }
  return paymentJson(request, { name });
}
