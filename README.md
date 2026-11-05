# backend-starter-kit

API احراز هویت با شماره موبایل ایران، با کد یک‌بارمصرف و رمز اختیاری. فرانت جداگانه از همین مسیرها استفاده می‌کند. مستندات تعاملی روی `/docs` است.

## راه‌اندازی

```bash
npm install
npm run db:up
npx prisma migrate deploy
npm run dev
```

سپس [http://localhost:3000/docs](http://localhost:3000/docs) را باز کنید. قرارداد خام در `/openapi.json` است.

Postgres 18.4 روی پورت `5433` و Redis 8 روی پورت `6379` با `docker compose` بالا می‌آیند. مقدارها در `.env.example` هستند.

## مسیرها

- `POST /api/auth/identify`
- `POST /api/auth/password/login`
- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `POST /api/auth/password/set`
- `POST /api/auth/password/reset`

نشست موفق در کوکی `HttpOnly` به نام `session` قرار می‌گیرد. درخواست‌های `POST` باید هدر `Origin` هم‌مبدأ با `Host` داشته باشند.

## تست

```bash
npm test
```
