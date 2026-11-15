# backend-starter-kit

API احراز هویت با شماره موبایل ایران، با کد یک‌بارمصرف و رمز اختیاری، به‌همراه شارژ کیف‌پول زرین‌پال. فرانت جداگانه از همین مسیرها استفاده می‌کند. مستندات تعاملی روی `/docs` است.

## راه‌اندازی

برای استقرار نسخهٔ staging برنامهٔ `backend-starter-kit` روی لیارا و اتصال فرانت موجود، [راهنمای لیارا](docs/liara.md) را دنبال کنید.

### اجرای کامل با Docker

```bash
cp .env.example .env
docker compose up -d --build --wait
```

این دستور به Docker و Compose نیاز دارد. اگر Compose روی سیستم شما به‌صورت دستور مستقل نصب شده است، به‌جای `docker compose` از `docker-compose` استفاده کنید.

اگر از قبل `.env` دارید، آن را نگه دارید. پیش از اجرای واقعی، مقدارهای `OTP_PEPPER`، `PAYMENT_CALLBACK_HMAC_SECRET` و `PAYMENT_CARD_ENCRYPTION_KEY` را با رشته‌های تصادفی مستقل حداقل ۳۲ کاراکتری جایگزین کنید و تنظیمات پیامک و پرداخت را تکمیل کنید. برای ساخت هر مقدار می‌توانید `openssl rand -hex 32` اجرا کنید.

اپلیکیشن با حالت production روی [http://localhost:3000/docs](http://localhost:3000/docs) اجرا می‌شود. Compose ابتدا منتظر آماده‌شدن Postgres می‌ماند، migrationهای Prisma را اعمال می‌کند و سپس اپلیکیشن را با Redis آماده اجرا می‌کند. آدرس اتصال دیتابیس و Redis داخل کانتینرها خودکار تنظیم می‌شود؛ سایر تنظیمات هنگام اجرا از `.env` خوانده می‌شوند. فایل‌های `.env` وارد ایمیج نمی‌شوند.

```bash
docker compose logs -f app migrate
docker compose down
```

داده‌های Postgres در volume ماندگار هستند؛ `docker compose down` آن‌ها را حذف نمی‌کند. Redis مانند تنظیمات قبلی ماندگار نیست و با بازسازی کانتینر، نشست‌ها و کدهای موقت آن پاک می‌شوند. پورت‌ها فقط روی localhost منتشر شده‌اند. برای استقرار روی سرور، reverse proxy و HTTPS را تنظیم کنید، آدرس‌های عمومی پرداخت و `FRONTEND_ORIGINS` را در `.env` قرار دهید و `TRUSTED_PROXY_COUNT` را متناسب با تعداد پراکسی‌های مورد اعتماد تنظیم کنید. کوکی نشست در حالت production به HTTPS نیاز دارد.

### توسعهٔ محلی

```bash
cp .env.example .env
npm install
npm run db:up
npx prisma migrate deploy --config prisma7.config.ts
npm run dev
```

سپس [http://localhost:3000/docs](http://localhost:3000/docs) را باز کنید. قرارداد خام در `/openapi.json` است.

Postgres 18.4 روی پورت `5433` و Redis 8 روی پورت `6379` با `docker compose` بالا می‌آیند. مقدارها در `.env.example` هستند.

اتصال اول روی سندباکس زرین‌پال است (`ZARINPAL_SANDBOX=true`). برای مرچنت‌آیدی یک UUID کافی است و مبلغی کم نمی‌شود. بعد از ثبت‌نام پذیرنده در [این لینک](https://next.zarinpal.com/auth/register?ref_id=1tjG3k) همان شناسهٔ صادرشده را در `ZARINPAL_MERCHANT_ID` بگذارید و `ZARINPAL_SANDBOX` را `false` کنید.

## مسیرها

- `POST /api/v1/auth/identify`
- `POST /api/v1/auth/password/login`
- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/password/set`
- `POST /api/v1/auth/password/reset`
- `GET /api/v1/auth/token`
- `GET /api/v1/wallets`
- `POST /api/v1/wallets`
- `GET /api/v1/wallets/{teamId}/transactions`
- `POST /api/v1/payment/initiate`
- `GET /api/v1/payment/callback/zarinpal`
- `POST /api/v1/payment/reverse`
- `POST /api/v1/payment/refunds`
- `GET /api/v1/payment/refunds`
- `POST /api/v1/payment/recover`

نشست موفق در کوکی `HttpOnly` به نام `session` قرار می‌گیرد. درخواست‌های `POST` باید هدر `Origin` هم‌مبدأ با `Host` داشته باشند. POSTهای کیف علاوه بر Origin به کوکی `csrf-token` و هدر `x-csrf-token` نیاز دارند. کال‌بک زرین‌پال از CSRF معاف است و با HMAC چک می‌شود.

موجودی از آخرین ردیف دفترکل خوانده می‌شود. `refund` فقط درخواست استرداد دستی به کارت است؛ برگشت فوری درگاه همان `reverse` تا ۳۰ دقیقه است. برای یک شارژ فقط یکی از این دو باز می‌ماند.

## تست

```bash
npm test
```
