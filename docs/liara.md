# استقرار staging بک‌اند در لیارا

برنامهٔ Docker بک‌اند باید با نام `backend-starter-kit` در تیم `6af1f3327b73964d457bf0d8` جدا از فرانت ساخته شود. فایل `liara.json` برای build در آلمان و پورت `3000` تنظیم شده است؛ Dockerfile نیز روی `0.0.0.0:3000` گوش می‌دهد. این تنظیمات مطابق [راهنمای Docker لیارا](https://docs.liara.ir/paas/docker/how-tos/deploy-app/) هستند.

این نسخه برای **staging** است. مقدار `NODE_ENV=production` حالت اجرای build‌شدهٔ Next.js را مشخص می‌کند؛ آن را به `stage` یا `staging` تغییر ندهید، چون Next.js تنها `development`، `production` و `test` را برای این متغیر می‌پذیرد. staging با دیتابیس، Redis، کلیدها و تنظیمات سندباکس مستقل از محیط عملیاتی اجرا می‌شود.

## سرویس‌های staging

سرویس‌های زیر در همین تیم ساخته شده‌اند و هنگام بررسی وضعیت هر دو `OK` بود:

| سرویس | نام در لیارا | متغیر اتصال بک‌اند |
| --- | --- | --- |
| Postgres | `starter-kit` | `DATABASE_URL` |
| Redis | `starter-kit-redis` | `REDIS_URL` |

رشتهٔ اتصال هر سرویس را از کنسول لیارا در تنظیمات محیطی برنامهٔ `backend-starter-kit` قرار دهید؛ رمزها را در این فایل یا Git ثبت نکنید. نام سرویس به‌تنهایی رشتهٔ اتصال نیست. برای اتصال خصوصی، بک‌اند و هر دو سرویس باید طبق تنظیمات شبکهٔ لیارا به یکدیگر دسترسی داشته باشند. مقادیر localhost و نام‌های `postgres` و `redis` در Compose مختص اجرای محلی هستند و نباید در تنظیمات لیارا استفاده شوند.

## متغیرهای محیطی بک‌اند

مقادیر زیر را در تنظیمات محیطی **برنامهٔ بک‌اند staging** ثبت کنید. فایل‌های محلی `.env` با پروژه آپلود نمی‌شوند. کلیدهای staging باید مستقل از محیط عملیاتی و متفاوت از مقادیر نمونه باشند.

برای بارگذاری در کنسول لیارا از فایل محلی `.env.staging` استفاده کنید؛ قالب آن `KEY=value` بدون کوتیشن و کامنت است. در بررسی تنظیمات این استقرار، واردکنندهٔ کنسول کوتیشن‌ها را جزو مقدار ذخیره کرده بود. مقدار نهایی `NODE_ENV` باید دقیقاً `production` و مقدار `ZARINPAL_SANDBOX` دقیقاً `true` باشد.

| متغیر | مقدار |
| --- | --- |
| `NODE_ENV` | `production`؛ حالت runtime برای build نسخهٔ staging |
| `APP_ENV` | `staging` برای این محیط؛ هنگام انتشار عملیاتی `production` |
| `OTP_EXPOSE_CODE` | `true` در staging و فقط با `SMS_PROVIDER=console` برای دریافت کد OTP در فیلد `devCode` پاسخ درخواست کد؛ در محیط عملیاتی `false` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |
| `DATABASE_URL` | رشتهٔ اتصال Postgres ساخته‌شده با نام `starter-kit`؛ با نام کاربری، رمز و تنظیم TLS سرویس |
| `REDIS_URL` | رشتهٔ اتصال Redis ساخته‌شده با نام `starter-kit-redis`؛ شامل احراز هویت و TLS در صورت نیاز |
| `FRONTEND_ORIGINS` | `https://frontend-satrter-kit.liara.run` |
| `TRUSTED_PROXY_COUNT` | تعداد hopهای پراکسی مورد اعتماد، پس از بررسی زنجیرهٔ واقعی لیارا و پراکسی فرانت؛ مقدار پیش‌فرض امن `0` است |
| `OTP_PEPPER` | راز تصادفی مستقل با حداقل ۳۲ کاراکتر |
| `PAYMENT_CALLBACK_HMAC_SECRET` | راز تصادفی مستقل با حداقل ۳۲ کاراکتر |
| `PAYMENT_CARD_ENCRYPTION_KEY` | راز تصادفی مستقل با حداقل ۳۲ کاراکتر؛ برای خواندن اطلاعات قبلی باید ثابت بماند |
| `ZARINPAL_MERCHANT_ID` | شناسهٔ سندباکس؛ برای تست یک UUID مطابق `.env.example` کافی است |
| `ZARINPAL_SANDBOX` | `true` برای این نسخهٔ staging |
| `PAYMENT_CALLBACK_BASE_URL` | `https://backend-starter-kit.liara.run` |
| `PAYMENT_SUCCESS_REDIRECT_URL` | مسیر واقعی صفحهٔ نتیجهٔ موفق در فرانت |
| `PAYMENT_FAILURE_REDIRECT_URL` | مسیر واقعی صفحهٔ نتیجهٔ ناموفق در فرانت |
| `SMS_PROVIDER` | `console` فقط برای آزمایش؛ `ippanel` برای ارسال واقعی پیامک الگویی و کد صوتی |
| `IPPANEL_API_TOKEN` | توکن IPPanel برای ارسال واقعی، بدون پیشوند Bearer |
| `IPPANEL_FROM_NUMBER` | شمارهٔ فرستندهٔ حساب با فرمت E.164؛ برای پیامک الزامی است |
| `IPPANEL_PATTERN_CODE` | کد الگوی پیامک |
| `IPPANEL_PATTERN_PARAM` | نام متغیر کد در الگو؛ پیش‌فرض `code` |
| `SMS_DEV_LOG` | `false`؛ نمایش کد در پاسخ staging با `OTP_EXPOSE_CODE` کنترل می‌شود |

سایر محدودیت‌ها و تنظیمات اختیاری در `.env.example` مشخص هستند. برای هر راز می‌توانید یک بار `openssl rand -hex 32` اجرا کنید و خروجی را مستقیماً در تنظیمات محرمانهٔ لیارا نگه دارید.

در staging نیز `NODE_ENV=production` است. فقط با `SMS_PROVIDER=console` و `APP_ENV=staging` و `OTP_EXPOSE_CODE=true`، پاسخ موفق `POST /api/v1/auth/otp/request` علاوه بر `cooldownSeconds` فیلد `devCode` را هم دارد؛ همین کد را به endpoint تأیید OTP بفرستید. پاسخ با `Cache-Control: no-store` برمی‌گردد و کد در لاگ staging چاپ نمی‌شود. `SMS_PROVIDER=console` پیامک واقعی ارسال نمی‌کند. با `SMS_PROVIDER=ippanel` یا `vendor`، کد هرگز در `devCode` برنمی‌گردد، حتی اگر پرچم‌های نمایش کد فعال باشند. برای انتشار عملیاتی، `APP_ENV=production` و `OTP_EXPOSE_CODE=false` تنظیم کنید.

Compose فقط برای اجرای محلی است. لیارا تنها Dockerfile را build می‌کند؛ سرویس‌های Postgres، Redis و migration در Compose به‌طور خودکار روی لیارا اجرا نمی‌شوند. بک‌اند به دیسک محلی نیازی ندارد؛ داده‌ها در سرویس‌های Postgres و Redis نگهداری می‌شوند.

## Migration و استقرار

قبل از فعال‌کردن نسخهٔ جدید staging، از یک محیط مورد اعتماد که به دیتابیس `starter-kit` دسترسی دارد migrationها را اجرا کنید. `DATABASE_URL` همین دیتابیس staging را به‌صورت محرمانه در محیط همان فرایند تنظیم کنید. فرمان پیش‌فرض Prisma در صورت نبودن این متغیر به دیتابیس محلی برمی‌گردد؛ بنابراین وجود متغیر را بررسی کنید:

```bash
npm ci
node -e 'if (!process.env.DATABASE_URL) throw new Error("Export staging DATABASE_URL first")' && npm run db:migrate
```

ایمیج نهایی ابزار Prisma و migrationها را نیز دارد تا بتوان آن‌ها را داخل شبکهٔ خصوصی لیارا، بدون دانلود بسته در زمان اجرا، اعمال کرد. پس از deploy این فرمان را اجرا کنید؛ آدرس دیتابیس از متغیرهای محیطی همان کانتینر خوانده می‌شود:

```bash
liara shell --app backend-starter-kit --team-id 6af1f3327b73964d457bf0d8 --command 'node node_modules/prisma/build/index.js migrate deploy --config prisma7.config.ts'
```

فقط ابزار migration هنگام build کپی می‌شود؛ خود migration هنگام اجرای فرمان بالا انجام می‌شود. رشتهٔ اتصال را در build argument قرار ندهید.

پس از آماده‌شدن برنامهٔ جداگانه، متغیرهای محیطی و دیتابیس:

```bash
liara login
liara deploy --no-app-logs
curl --fail-with-body https://backend-starter-kit.liara.run/openapi.json
```

CLI نام برنامه، تیم، پورت و محل build را از `liara.json` می‌خواند؛ توضیحات در [مرجع استقرار CLI](https://docs.liara.ir/references/cli/deploy-app/) است. `/openapi.json` سلامت پاسخ‌گویی HTTP را بررسی می‌کند؛ اتصال دیتابیس و Redis باید با درخواست‌های احراز هویت و کیف‌پول هم بررسی شود.

## اتصال فرانت

در تنظیمات محیطی **برنامهٔ فرانت** `frontend-satrter-kit` ثبت کنید:

```ini
API_ORIGIN=https://backend-starter-kit.liara.run
```

`NEXT_PUBLIC_API_ORIGIN` را حذف کنید و فرانت را دوباره deploy کنید. مسیر `/api/v1` را به `API_ORIGIN` اضافه نکنید. مرورگر همچنان از مسیرهای هم‌مبدأ فرانت استفاده می‌کند و پراکسی درخواست را به بک‌اند می‌رساند.

بررسی Origin بک‌اند از قبل `FRONTEND_ORIGINS` و تطابق Origin با Host را می‌پذیرد؛ بنابراین Origin و Host حفظ‌شدهٔ فرانت با همین تنظیمات پشتیبانی می‌شوند. کوکی‌های `session` و `csrf-token` از قبل فاقد `Domain` هستند و از طریق پاسخ پراکسی به دامنهٔ فرانت تعلق می‌گیرند. کوکی‌ها در production با `Secure` ثبت می‌شوند. پراکسی فرانت باید Cookie، تمام هدرهای Set-Cookie و هدر `x-csrf-token` را منتقل کند.

پس از استقرار، ورود، حفظ نشست پس از refresh و درخواست‌های `GET /api/v1/wallets` و `POST /api/v1/wallets` را از فرانت بررسی کنید. درخواست POST کیف‌پول به کوکی CSRF و هدر مطابق آن نیاز دارد. این بک‌اند در حال حاضر endpoint خروج از حساب ندارد؛ بررسی logout سروری به پیاده‌سازی آن نیاز دارد. برای ارسال واقعی، `SMS_PROVIDER=ippanel` و تنظیمات IPPanel را وارد کنید. در درخواست OTP، مقدار اختیاری `channel` برابر `sms` یا `voice` است و پیش‌فرض `sms` می‌ماند.
