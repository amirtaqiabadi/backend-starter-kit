import { paymentMessages } from "@/domain/payment/messages";
import { requireSession } from "@/server/auth/require-session";
import { csrfMatches } from "@/server/csrf";
import { getPrisma } from "@/server/db";
import { isSameOrigin, requestTraceId } from "@/server/http";
import { paymentFailureResponse, paymentJson } from "@/server/payment/response";
import { paymentFail } from "@/server/payment/result";
import { avatarToWebp, deleteAvatar, MAX_AVATAR_BYTES, uploadAvatar } from "@/server/storage/avatar";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = MAX_AVATAR_BYTES + 64 * 1024;

export async function POST(request: Request) {
  const traceId = requestTraceId(request);
  const fail = (status: number, type: "DOMAIN_ERROR" | "VALIDATION_ERROR" | "SYSTEM_ERROR", code: string, message: string) =>
    paymentFailureResponse(paymentFail({ status, type, code, message }), traceId, request);
  if (!isSameOrigin(request)) return fail(403, "DOMAIN_ERROR", "FORBIDDEN_ORIGIN", paymentMessages.forbiddenOrigin);
  if (!csrfMatches(request)) return fail(403, "DOMAIN_ERROR", "INVALID_CSRF", paymentMessages.invalidCsrf);
  const session = await requireSession(request);
  if (!session) return fail(401, "DOMAIN_ERROR", "UNAUTHORIZED", paymentMessages.unauthorized);

  // Bound the stream before parsing multipart, including when Content-Length is missing or false.
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return fail(413, "VALIDATION_ERROR", "AVATAR_TOO_LARGE", "حجم تصویر باید حداکثر ۵ مگابایت باشد.");
  let form: FormData;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return fail(413, "VALIDATION_ERROR", "AVATAR_TOO_LARGE", "حجم تصویر باید حداکثر ۵ مگابایت باشد.");
      }
      chunks.push(value);
    }
    form = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return fail(400, "VALIDATION_ERROR", "INVALID_AVATAR", "یک فایل تصویر معتبر ارسال کنید.");
  }
  const files = form.getAll("file");
  const file = files[0];
  if (files.length !== 1 || [...form.keys()].some((key) => key !== "file") || !(file instanceof File) || !file.size) {
    return fail(400, "VALIDATION_ERROR", "INVALID_AVATAR", "یک فایل تصویر معتبر ارسال کنید.");
  }
  if (file.size > MAX_AVATAR_BYTES) return fail(413, "VALIDATION_ERROR", "AVATAR_TOO_LARGE", "حجم تصویر باید حداکثر ۵ مگابایت باشد.");
  let webp: Buffer;
  try {
    webp = await avatarToWebp(Buffer.from(await file.arrayBuffer()));
  } catch {
    return fail(400, "VALIDATION_ERROR", "INVALID_AVATAR", "یک فایل تصویر معتبر ارسال کنید.");
  }
  try {
    const uploaded = await uploadAvatar(session.userId, webp);
    try {
      const result = await getPrisma().user.updateMany({ where: { id: session.userId }, data: { avatarUrl: uploaded.url } });
      if (!result.count) {
        await uploaded.rollback().catch(() => {});
        return fail(401, "DOMAIN_ERROR", "UNAUTHORIZED", paymentMessages.unauthorized);
      }
    } catch (error) {
      await uploaded.rollback().catch(() => {});
      throw error;
    }
    return paymentJson(request, { avatarUrl: uploaded.url });
  } catch {
    return fail(503, "SYSTEM_ERROR", "AVATAR_UPLOAD_FAILED", "بارگذاری تصویر ناموفق بود؛ دوباره تلاش کنید.");
  }
}

/** Remove the current avatar without clearing a newer concurrent upload. */
export async function DELETE(request: Request) {
  const traceId = requestTraceId(request);
  const fail = (status: number, type: "DOMAIN_ERROR" | "SYSTEM_ERROR", code: string, message: string) =>
    paymentFailureResponse(paymentFail({ status, type, code, message }), traceId, request);
  if (!isSameOrigin(request)) return fail(403, "DOMAIN_ERROR", "FORBIDDEN_ORIGIN", paymentMessages.forbiddenOrigin);
  if (!csrfMatches(request)) return fail(403, "DOMAIN_ERROR", "INVALID_CSRF", paymentMessages.invalidCsrf);
  const session = await requireSession(request);
  if (!session) return fail(401, "DOMAIN_ERROR", "UNAUTHORIZED", paymentMessages.unauthorized);

  try {
    const user = await getPrisma().user.findUnique({ where: { id: session.userId }, select: { avatarUrl: true } });
    if (!user) return fail(401, "DOMAIN_ERROR", "UNAUTHORIZED", paymentMessages.unauthorized);
    if (user.avatarUrl) {
      await deleteAvatar(session.userId, user.avatarUrl);
      const result = await getPrisma().user.updateMany({
        where: { id: session.userId, avatarUrl: user.avatarUrl }, data: { avatarUrl: null },
      });
      if (!result.count) return fail(409, "DOMAIN_ERROR", "AVATAR_CHANGED", "تصویر پروفایل تغییر کرده است؛ دوباره تلاش کنید.");
    }
    return paymentJson(request, { avatarUrl: null });
  } catch {
    return fail(503, "SYSTEM_ERROR", "AVATAR_DELETE_FAILED", "حذف تصویر ناموفق بود؛ دوباره تلاش کنید.");
  }
}
