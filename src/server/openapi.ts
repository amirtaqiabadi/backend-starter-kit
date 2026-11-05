/** Why: the contract is served from this process so a separate frontend can read the same spec as Swagger. */
export function openApiDocument() {
  return {
    openapi: "3.0.3",
    info: {
      title: "backend-starter-kit",
      version: "0.1.0",
      description:
        "احراز هویت با شماره موبایل ایران. همهٔ درخواست‌های POST باید هدر Origin هم‌مبدأ با Host داشته باشند. نشست موفق در کوکی HttpOnly به نام session قرار می‌گیرد.",
    },
    tags: [{ name: "auth" }],
    paths: {
      "/api/auth/identify": {
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
      "/api/auth/password/login": {
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
      "/api/auth/otp/request": {
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
      "/api/auth/otp/verify": {
        post: {
          tags: ["auth"],
          summary: "تأیید کد و ساخت نشست",
          description:
            "purpose برابر RESET_PASSWORD علاوه بر نشست، اجازهٔ یک‌بار تغییر رمز را برای همین نشست فعال می‌کند.",
          requestBody: jsonBody({
            required: ["phoneNumber", "code"],
            properties: {
              phoneNumber: phoneSchema,
              code: { type: "string", pattern: "^\\d{5}$" },
              purpose: { type: "string", enum: ["LOGIN", "RESET_PASSWORD"], default: "LOGIN" },
              next: nextSchema,
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
      "/api/auth/password/set": {
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
      "/api/auth/password/reset": {
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
    },
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
      },
    },
  };
}

const phoneSchema = { type: "string", pattern: "^09\\d{9}$", example: "09123456789" };
const passwordSchema = { type: "string", minLength: 8, maxLength: 128 };
const nextSchema = { type: "string", description: "فقط یک مسیر نسبی با یک اسلش ابتدایی." };
const okSchema = {
  type: "object",
  required: ["ok"],
  properties: { ok: { type: "boolean", enum: [true] } },
};
const errorResponse = { description: "خطا", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };

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
