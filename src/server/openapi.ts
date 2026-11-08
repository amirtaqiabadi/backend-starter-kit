import { API_PREFIX } from "@/server/api-prefix";

/** Why: the contract is served from this process so a separate frontend can read the same spec as Swagger. */
export function openApiDocument() {
  return {
    openapi: "3.0.3",
    info: {
      title: "backend-starter-kit",
      version: "0.1.0",
      description:
        "احراز هویت با شماره موبایل ایران و شارژ کیف‌پول زرین‌پال. همهٔ درخواست‌های POST باید هدر Origin هم‌مبدأ با Host داشته باشند. نشست موفق در کوکی HttpOnly به نام session قرار می‌گیرد. POSTهای کیف علاوه بر Origin به هدر x-csrf-token نیاز دارند.",
    },
    tags: [{ name: "auth" }, { name: "wallets" }, { name: "payment" }],
    paths: withApiPrefix({
      "/auth/identify": {
        post: {
          tags: ["auth"],
          summary: "انتخاب مرحلهٔ بعد",
          description: "وجود رمز را برمی‌گرداند و وجود حساب را فاش نمی‌کند.",
          requestBody: jsonBody({
            required: ["phoneNumber"],
            properties: { phoneNumber: phoneSchema },
          }),
          responses: {
            "200": jsonResponse("مرحلهٔ بعد", {
              type: "object",
              required: ["nextStep"],
              properties: { nextStep: { type: "string", enum: ["PASSWORD", "OTP"] } },
            }),
            "400": errorResponse,
            "403": errorResponse,
            "429": errorResponse,
          },
        },
      },
      "/auth/password/login": {
        post: {
          tags: ["auth"],
          summary: "ورود با رمز",
          description: "شمارهٔ ناشناس، رمز نادرست و حساب بدون رمز پاسخ یکسان می‌دهند.",
          requestBody: jsonBody({
            required: ["phoneNumber", "password"],
            properties: {
              phoneNumber: phoneSchema,
              password: { type: "string" },
              next: nextSchema,
            },
          }),
          responses: {
            "200": sessionResponse("مسیر امن بعد از ورود", {
              type: "object",
              required: ["redirectTo"],
              properties: { redirectTo: { type: "string" } },
            }),
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "429": errorResponse,
          },
        },
      },
      "/auth/otp/request": {
        post: {
          tags: ["auth"],
          summary: "درخواست کد پیامکی",
          description:
            "devCode فقط وقتی برمی‌گردد که NODE_ENV غیر از production باشد و SMS_DEV_LOG=true.",
          requestBody: jsonBody({
            required: ["phoneNumber"],
            properties: { phoneNumber: phoneSchema },
          }),
          responses: {
            "200": jsonResponse("مهلت ارسال دوباره", {
              type: "object",
              required: ["cooldownSeconds"],
              properties: {
                cooldownSeconds: { type: "integer" },
                devCode: { type: "string", pattern: "^\\d{5}$" },
              },
            }),
            "400": errorResponse,
            "403": errorResponse,
            "429": errorResponse,
            "503": errorResponse,
          },
        },
      },
      "/auth/otp/verify": {
        post: {
          tags: ["auth"],
          summary: "تأیید کد و ساخت نشست",
          description:
            "purpose برابر RESET_PASSWORD علاوه بر نشست، اجازهٔ یک‌بار تغییر رمز را برای همین نشست فعال می‌کند. token اختیاری است و فقط وقتی حساب همین حالا ساخته می‌شود به دعوت‌کننده وصل می‌شود. توکن نامعتبر ورود را رد نمی‌کند.",
          requestBody: jsonBody({
            required: ["phoneNumber", "code"],
            properties: {
              phoneNumber: phoneSchema,
              code: { type: "string", pattern: "^\\d{5}$" },
              purpose: { type: "string", enum: ["LOGIN", "RESET_PASSWORD"], default: "LOGIN" },
              next: nextSchema,
              token: tokenSchema,
            },
          }),
          responses: {
            "200": sessionResponse("نشست و وضعیت رمز", {
              type: "object",
              required: ["hasPassword", "redirectTo"],
              properties: {
                hasPassword: { type: "boolean" },
                redirectTo: { type: "string" },
              },
            }),
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
          },
        },
      },
      "/auth/token": {
        get: {
          tags: ["auth"],
          summary: "توکن عمومی کاربر جاری",
          security: [{ sessionCookie: [] }],
          responses: {
            "200": jsonResponse("توکن دعوت", {
              type: "object",
              required: ["token"],
              properties: { token: { type: "string", pattern: "^[ACDEFGHJKMNPQRTVWXYZ234679]{5}$" } },
            }),
            "401": errorResponse,
          },
        },
      },
      "/auth/password/set": {
        post: {
          tags: ["auth"],
          summary: "تنظیم رمز برای حساب بدون رمز",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            required: ["password"],
            properties: { password: passwordSchema },
          }),
          responses: {
            "200": jsonResponse("رمز ذخیره شد", okSchema),
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
            "409": errorResponse,
          },
        },
      },
      "/auth/password/reset": {
        post: {
          tags: ["auth"],
          summary: "جایگزینی رمز بعد از تأیید کد",
          description: "نشست فعلی می‌ماند و بقیهٔ نشست‌های کاربر حذف می‌شوند.",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            required: ["password"],
            properties: { password: passwordSchema },
          }),
          responses: {
            "200": jsonResponse("رمز جایگزین شد", okSchema),
            "400": errorResponse,
            "401": errorResponse,
            "403": errorResponse,
          },
        },
      },
      "/wallets": {
        get: {
          tags: ["wallets"],
          summary: "لیست کیف‌های فعال",
          security: [{ sessionCookie: [] }],
          responses: {
            "200": jsonResponse("کیف‌ها و موجودی دفترکل", {
              type: "object",
              required: ["wallets"],
              properties: {
                wallets: { type: "array", items: { $ref: "#/components/schemas/Wallet" } },
              },
            }),
            "401": paymentErrorResponse,
          },
        },
        post: {
          tags: ["wallets"],
          summary: "ساخت کیف جدید",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            properties: { displayName: { type: "string", minLength: 1, maxLength: 80 } },
          }),
          responses: {
            "201": jsonResponse("کیف ساخته شد", { $ref: "#/components/schemas/Wallet" }),
            "400": paymentErrorResponse,
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
          },
        },
      },
      "/wallets/{teamId}/transactions": {
        get: {
          tags: ["wallets"],
          summary: "تاریخچهٔ دفترکل یک کیف",
          security: [{ sessionCookie: [] }],
          parameters: [{ name: "teamId", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            "200": jsonResponse("ردیف‌های دفترکل", {
              type: "object",
              required: ["transactions"],
              properties: { transactions: { type: "array", items: { $ref: "#/components/schemas/LedgerRow" } } },
            }),
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
          },
        },
      },
      "/payment/initiate": {
        post: {
          tags: ["payment"],
          summary: "شروع شارژ با زرین‌پال",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            required: ["amount", "description"],
            properties: {
              amount: { type: "integer", minimum: 1000, description: "ریال" },
              description: { type: "string", minLength: 1, maxLength: 500 },
              teamId: { type: "integer" },
            },
          }),
          responses: {
            "200": jsonResponse("آدرس درگاه", {
              type: "object",
              required: ["paymentUrl", "attemptId"],
              properties: {
                paymentUrl: { type: "string" },
                attemptId: { type: "integer" },
              },
            }),
            "400": paymentErrorResponse,
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
            "429": paymentErrorResponse,
            "502": paymentErrorResponse,
            "503": paymentErrorResponse,
          },
        },
      },
      "/payment/callback/zarinpal": {
        get: {
          tags: ["payment"],
          summary: "بازگشت زرین‌پال",
          description: "بدون نشست است و اول امضای HMAC را چک می‌کند. مرورگر را به صفحهٔ موفقیت یا شکست هدایت می‌کند.",
          parameters: [
            { name: "sig", in: "query", required: true, schema: { type: "string" } },
            { name: "Authority", in: "query", required: true, schema: { type: "string" } },
            { name: "Status", in: "query", required: true, schema: { type: "string", enum: ["OK", "NOK"] } },
          ],
          responses: {
            "307": { description: "هدایت به صفحهٔ موفقیت یا شکست" },
          },
        },
      },
      "/payment/reverse": {
        post: {
          tags: ["payment"],
          summary: "برگشت درگاه تا ۳۰ دقیقه، مگر اینکه استرداد کارت باز باشد",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            required: ["attemptId"],
            properties: { attemptId: { type: "integer" } },
          }),
          responses: {
            "200": jsonResponse("برگشت ثبت شد", {
              type: "object",
              required: ["attemptId"],
              properties: { attemptId: { type: "integer" } },
            }),
            "400": paymentErrorResponse,
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
            "409": paymentErrorResponse,
            "502": paymentErrorResponse,
          },
        },
      },
      "/payment/refunds": {
        get: {
          tags: ["payment"],
          summary: "لیست درخواست‌های استرداد کارت",
          security: [{ sessionCookie: [] }],
          parameters: [{ name: "teamId", in: "query", required: true, schema: { type: "integer" } }],
          responses: {
            "200": jsonResponse("درخواست‌ها با کارت ماسک‌شده", {
              type: "object",
              required: ["refunds"],
              properties: { refunds: { type: "array", items: { $ref: "#/components/schemas/Refund" } } },
            }),
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
          },
        },
        post: {
          tags: ["payment"],
          summary: "ثبت درخواست استرداد دستی به کارت، مگر اینکه برگشت درگاه شروع شده باشد",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            required: ["transactionId", "cardNumber"],
            properties: {
              transactionId: { type: "integer" },
              cardNumber: { type: "string", pattern: "^\\d{16}$" },
            },
          }),
          responses: {
            "201": jsonResponse("درخواست ثبت شد", { $ref: "#/components/schemas/Refund" }),
            "400": paymentErrorResponse,
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
            "409": paymentErrorResponse,
          },
        },
      },
      "/payment/recover": {
        post: {
          tags: ["payment"],
          summary: "بازیابی پرداخت بدون کال‌بک",
          security: [{ sessionCookie: [] }],
          requestBody: jsonBody({
            properties: { authority: { type: "string" } },
          }),
          responses: {
            "200": jsonResponse("تعداد بازیابی‌شده", {
              type: "object",
              required: ["recovered"],
              properties: { recovered: { type: "integer" } },
            }),
            "401": paymentErrorResponse,
            "403": paymentErrorResponse,
            "404": paymentErrorResponse,
            "503": paymentErrorResponse,
          },
        },
      },
    }),
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "session" },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: {
                  type: "string",
                  enum: [
                    "INVALID_PHONE",
                    "INVALID_BODY",
                    "INVALID_PASSWORD",
                    "COMMON_PASSWORD",
                    "INVALID_CREDENTIALS",
                    "FORBIDDEN_ORIGIN",
                    "RATE_LIMITED",
                    "LOCKED",
                    "OTP_COOLDOWN",
                    "OTP_MISMATCH",
                    "OTP_EXHAUSTED",
                    "OTP_EXPIRED",
                    "SMS_FAILED",
                    "UNAUTHORIZED",
                    "PASSWORD_EXISTS",
                    "RESET_NOT_ALLOWED",
                  ],
                },
                message: { type: "string" },
                attemptsRemaining: { type: "integer" },
                retryAfter: { type: "integer" },
              },
            },
          },
        },
        Wallet: {
          type: "object",
          required: ["teamId", "displayName", "role", "availableBalance", "restrictedBalance"],
          properties: {
            teamId: { type: "integer" },
            displayName: { type: "string" },
            role: { type: "string" },
            availableBalance: { type: "integer" },
            restrictedBalance: { type: "integer" },
          },
        },
        LedgerRow: {
          type: "object",
          required: ["id", "type", "amount", "availableBalanceAfter", "restrictedBalanceAfter", "createdAt"],
          properties: {
            id: { type: "integer" },
            type: { type: "string" },
            amount: { type: "integer" },
            availableBalanceAfter: { type: "integer" },
            restrictedBalanceAfter: { type: "integer" },
            gatewayAttemptId: { type: "integer", nullable: true },
            createdAt: { type: "string" },
          },
        },
        Refund: {
          type: "object",
          required: ["id", "teamId", "transactionId", "amount", "status", "cardNumber", "createdAt"],
          properties: {
            id: { type: "integer" },
            teamId: { type: "integer" },
            transactionId: { type: "integer" },
            amount: { type: "integer" },
            status: { type: "string" },
            cardNumber: { type: "string" },
            createdAt: { type: "string" },
          },
        },
        PaymentError: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["type", "code", "message", "traceId"],
              properties: {
                type: { type: "string", enum: ["VALIDATION_ERROR", "DOMAIN_ERROR", "SYSTEM_ERROR"] },
                code: { type: "string" },
                message: { type: "string" },
                traceId: { type: "string" },
              },
            },
          },
        },
      },
    },
  };
}

/** Why: published paths stay on the same version segment as the route folders. */
function withApiPrefix(paths: Record<string, object>) {
  return Object.fromEntries(Object.entries(paths).map(([path, operation]) => [`${API_PREFIX}${path}`, operation]));
}

const phoneSchema = { type: "string", pattern: "^09\\d{9}$", example: "09123456789" };
const passwordSchema = { type: "string", minLength: 8, maxLength: 128 };
const nextSchema = { type: "string", description: "فقط یک مسیر نسبی با یک اسلش ابتدایی." };
const tokenSchema = {
  type: "string",
  description: "توکن دعوت‌کننده. فاصله و خط تیره نادیده گرفته می‌شود.",
  example: "A2C46",
};
const okSchema = {
  type: "object",
  required: ["ok"],
  properties: { ok: { type: "boolean", enum: [true] } },
};
const errorResponse = { description: "خطا", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const paymentErrorResponse = {
  description: "خطای پرداخت",
  content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentError" } } },
};

/** Why: every auth call sends one JSON object. */
function jsonBody(schema: object) {
  return { required: true, content: { "application/json": { schema: { type: "object", ...schema } } } };
}

/** Why: success bodies share one content type. */
function jsonResponse(description: string, schema: object) {
  return { description, content: { "application/json": { schema } } };
}

/** Why: login responses also publish the session cookie. */
function sessionResponse(description: string, schema: object) {
  return {
    description,
    headers: {
      "Set-Cookie": { schema: { type: "string" }, description: "session؛ HttpOnly و SameSite=Lax" },
    },
    content: { "application/json": { schema } },
  };
}
