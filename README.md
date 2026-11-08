# backend-starter-kit

API احراز هویت با شماره موبایل ایران، با کد یک‌بارمصرف و رمز اختیاری، به‌همراه شارژ کیف‌پول زرین‌پال. فرانت جداگانه از همین مسیرها استفاده می‌کند. مستندات تعاملی روی `/docs` است.

## راه‌اندازی

```bash
npm install
npm run db:up
npx prisma migrate deploy
npm run dev
```

سپس [http://localhost:3000/docs](http://localhost:3000/docs) را باز کنید. قرارداد خام در `/openapi.json` است.

Postgres 18.4 روی پورت `5433` و Redis 8 روی پورت `6379` با `docker compose` بالا می‌آیند. مقدارها در `.env.example` هستند.

اتصال اول روی سندباکس زرین‌پال است (`ZARINPAL_SANDBOX=true`). برای مرچنت‌آیدی یک UUID کافی است و مبلغی کم نمی‌شود. بعد از ثبت‌نام پذیرنده در [این لینک](https://next.zarinpal.com/auth/register?ref_id=1tjG3k) همان شناسهٔ صادرشده را در `ZARINPAL_MERCHANT_ID` بگذارید و `ZARINPAL_SANDBOX` را `false` کنید.

## مسیرها

- `POST /api/auth/identify`
- `POST /api/auth/password/login`
- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `POST /api/auth/password/set`
- `POST /api/auth/password/reset`
- `GET /api/auth/token`
- `GET /api/wallets`
- `POST /api/wallets`
- `GET /api/wallets/{teamId}/transactions`
- `POST /api/payment/initiate`
- `GET /api/payment/callback/zarinpal`
- `POST /api/payment/reverse`
- `POST /api/payment/refunds`
- `GET /api/payment/refunds`
- `POST /api/payment/recover`

نشست موفق در کوکی `HttpOnly` به نام `session` قرار می‌گیرد. درخواست‌های `POST` باید هدر `Origin` هم‌مبدأ با `Host` داشته باشند. POSTهای کیف علاوه بر Origin به کوکی `csrf-token` و هدر `x-csrf-token` نیاز دارند. کال‌بک زرین‌پال از CSRF معاف است و با HMAC چک می‌شود.

موجودی از آخرین ردیف دفترکل خوانده می‌شود. `refund` فقط درخواست استرداد دستی به کارت است؛ برگشت فوری درگاه همان `reverse` تا ۳۰ دقیقه است. برای یک شارژ فقط یکی از این دو باز می‌ماند.

## تست

```bash
npm test
```
