# سایت شبکه‌ی TCC

[English](README.md) · **فارسی**

**سایت رسمی شبکه‌ی PvP ماینکرفت [TCC](https://tccmc.ir)** — همون جایی که بازیکن‌ها اکانت می‌سازن، تیرهاشونو می‌بینن، رنک و کازمتیک می‌خرن؛ و تیم هم از همون‌جا سرور رو می‌چرخونه.

[![CI](https://github.com/pnbx/tcc-web/actions/workflows/ci.yml/badge.svg)](https://github.com/pnbx/tcc-web/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-000?logo=nextdotjs)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> سرور: `tccmc.ir` · سایت: `site.tccmc.ir`

---

## این چیه؟

یه اپ Next.js (App Router، React Server Components) که کل سایت TCC رو می‌سازه:

- **بخش عمومی** — لندینگ، اخبار، لیست تیرها، پروفایل بازیکن‌ها، فروشگاه
- **بخش کاربر** — داشبورد، پروفایل، خریدها، وصل‌کردن اکانت ماینکرفت
- **بخش تیم** — چهار پنل جدا برای تستر، ادمین، مالک و دولوپر
- **یه API خصوصی** که پلاگین ماینکرفت و ربات تلگرام با اون حرف می‌زنن

دیتابیسش Postgres (Supabase) و ORMش Prismas. یه قانون مهم داره: **هیچ آمار و وضعیتی از خودش درنمی‌آره.** هر چی درباره‌ی سرور نشون می‌ده، از خود سرور خونده.

---

## چی داره؟

**اکانت و دسترسی**
- پسورد با Argon2id هش می‌شه، سشن‌ها توکن تصادفی‌ان و توی DB هش‌شده ذخیره می‌شن؛ هفت روز عمر دارن و با تغییر پسورد یا بن شدن باطل می‌شن.
- ورود دو مرحله‌ای (TOTP) اختیاری، محدودیت تلاش ورود بر اساس IP و یوزرنیم.
- دسترسی‌ها نقش × مجوز دقیق‌ان، مالک همه‌کاره‌ست. همه‌ی مسیرهای حساس سمت سرور چک می‌شن — قایم‌کردن دکمه اصلاً یعنی چیزی.
- اولین بار از `/setup` با `SETUP_KEY` اکانت مالک و دولوپر ساخته می‌شه. چیزی توی کد هاردکد نشده.
- وصل کردن تلگرام برای اعضا اجباریه، تا پیام «رنکت داره تموم می‌شه» واقعاً بهشون برسه.

**بخش رقابتی**
- دسته‌بندی تیر، تیر، تاریخچه و تست؛ تسترها از پنل خودشون تیر می‌دن.
- سینک خودکار: تیر رو تو بازی می‌دی، خودش روی سایت میاد — لازم نیست تستر بره سایت رو دست بزنه.
- پروفایل با آمار واقعی (کیل، دث، پلی‌تایم) که از PlaceholderAPI میاد.
- نتیجه‌ی دوئل‌ها از خطوط کنسول درمیاد؛ برد و باخت دستی وارد نمی‌شه.

**فروشگاه**
- سبد خرید، بازبینی قبل از پرداخت، رنک‌های ۱ / ۳ / ۱۲ ماهه.
- بعد از خرید، دستورها با `{uuid}` و `{username}` و `{player}` به سرور فرستاده می‌شن و برای هر کاربر ثبت می‌شن.
- کد تخفیف (رنک، مدت، ظرفیت، درصد) که از پنل مالک یا دولوپر ساخته می‌شه.
- **استودیوی هوش مصنوعی رنک و پرفیکس**: کاربر می‌گه چه تگی می‌خواد، مدل طرحش رو می‌ده، خروجی به MiniMessage تمیز می‌شه و قیمت می‌خوره. فحش و اسم‌های +۱۸ رد می‌شن.
- تایید پرداخت سمت سرور انجام می‌شه؛ سفارش تا وقتی درگاه تایید نکنه `PAID` نمی‌شه.

**پنل تیم**
- تستر: تیر و تست
- ادمین: اخبار، بازیکن‌ها، فروشگاه، تیرها، سرور
- مالک: کنسول، لاگ، مانیتورینگ، کد تخفیف، تنظیمات
- دولوپر: کنسول، فایل‌منیجر (سندباکس)، پلاگین‌ها، مانیتورینگ، سیستم
- هر کار حساس توی AuditLog با فاعل و هدف و IP ثبت می‌شه.

**زیرساخت**
- وضعیت زنده‌ی سرور با سه آداپتر، و یه فالبک که بدون هیچ کلیدی هم کار می‌کنه: Server List Ping. یعنی حتی اگه هیچ توکنی نداشته باشی، صفحه‌ی اصلی آنلاین‌بودن واقعی سرور رو نشون می‌ده.
- کرون روزانه برای انقضای رنک‌ها (`/api/cron/expiry`).
- سیستم تایپوگرافی فارسی با پنج فونت قابل تغییر از تنظیمات؛ فونت‌ها سلف‌هاست‌ان و چیز فنی (IP، UUID، دستور) با کلاس‌های `.mono` و `.ltr` چپ‌چین می‌مونه.

---

## معماری

```
مرورگر
   │  فقط HTTPS
   ▼
Next.js (RSC + route handlers، روی Vercel)
   ├── احراز هویت    Argon2id · سشن · TOTP · محدودیت ورود
   ├── دسترسی‌ها     نقش × مجوز، مالک همه‌کاره
   ├── دامنه         تیر · خبر · فروشگاه · بازیکن · کد تخفیف · استودیو
   ├── پرداخت        تایید سمت سرور
   ├── Audit         هر کار حساس
   └── ماینکرفت      آداپتر ↓
        ┌──────────────┬───────────────┬──────────────┬──────────────┐
      پلاگین بریج    Pterodactyl       RCON        Server List Ping
     (وضعیت، کنسول،   (پنل: وضعیت،   (فقط دستور)   (فقط وضعیت،
      پاور، فایل،      CPU، کنسول،                   همیشه کار می‌کنه)
      پلاگین، آمار)    پاور)
             │
        سرور بازی (Paper) + پلاگین TccBridge + محتوای Skript
```

ترتیب انتخاب آداپتر: **بریج → Pterodactyl → RCON → فقط وضعیت**. قراردادش تو [`src/lib/mc/types.ts`](src/lib/mc/types.ts) هست.

| آداپتر | چی می‌ده | تنظیمات |
|---|---|---|
| **بریج** (بهترین) | وضعیت، TPS/MSPT/CPU/RAM/دیسک/شبکه، کنسول، دستور، پاور، فایل، پلاگین، آمار بازیکن | `BRIDGE_URL`, `BRIDGE_TOKEN` |
| **Pterodactyl** | وضعیت، منابع، آپتایم، کنسول از `logs/latest.log`، دستور، پاور، فایل، لیست پلاگین | `PTERO_PANEL_URL`, `PTERO_API_KEY`, `PTERO_SERVER_ID` |
| **RCON** | فقط دستور و تعداد بازیکن | `RCON_*` — هیچ‌وقت عمومی نشه |
| **فقط وضعیت** | وضعیت واقعی با Server List Ping | هیچی لازم نیست |

جزئیات بیشتر: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/MINECRAFT.md](docs/MINECRAFT.md) · [docs/PAYMENTS.md](docs/PAYMENTS.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## راه‌اندازی

Node.js ۲۰ به بالا و یه دیتابیس Postgres (پلن رایگان Supabase هم کافیه).

```bash
git clone https://github.com/pnbx/tcc-web.git
cd tcc-web
npm install
cp .env.example .env          # مقادیرش رو پر کن
npx prisma db push            # ساخت جدول‌ها
npx prisma db seed            # نقش‌ها، مجوزها، تیرها، کاتالوگ فروشگاه
npm run dev
```

برو <http://localhost:3000/setup> و اولین اکانت **مالک** و **دولوپر** رو بساز. این صفحه `SETUP_KEY` می‌خواد، یعنی فقط کسی که دسترسی شل داره می‌تونه سایت رو بالا بیاره.

| دستور | کار |
|---|---|
| `npm run dev` | سرور توسعه با Turbopack |
| `npm run build` / `npm start` | بیلد و اجرای پروداکشن |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npx prisma studio` | دیدن دیتابیس |

---

## متغیرهای محیطی

`.env.example` همه‌چیز رو با کامنت توضیح داده. دسته‌بندی:

| دسته | کلیدها |
|---|---|
| دیتابیس | `SUPABASE_DB_URL`, `SUPABASE_POOLER_URL`, `DATABASE_URL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` |
| سشن | `SESSION_SECRET`, `JWT_SECRET` |
| راه‌اندازی اولیه | `SETUP_KEY`, `OWNER_USERNAME`, `DEVELOPER_INITIAL_PASSWORD` |
| ماینکرفت | `MINECRAFT_SERVER_HOST`, `MINECRAFT_SERVER_PORT`, `BRIDGE_URL`, `BRIDGE_TOKEN`, `MC_INGEST_TOKEN`, `RCON_*`, `PTERO_*`, `SERVER_FILES_ROOT` |
| پرداخت | `PAYMENT_PROVIDER`, `PAYMENT_PROVIDER_MERCHANT_ID`, `PAYMENT_PROVIDER_CALLBACK_BASE`, `ZIBAL_RELAY_URL`, `ZIBAL_RELAY_SECRET` |
| اتصال‌ها | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `BOT_API_TOKEN`, `OPENROUTER_API_KEYS`, `OPENROUTER_MODELS`, `CRON_SECRET` |

برای ساختن سکرت واقعی: `openssl rand -base64 48`. فایل `.env` هیچ‌وقت کامیت نمی‌شه و تا حالا هم نشده.

چی بدون کلید کار نمی‌کنه:

| قابلیت | چی لازم داره |
|---|---|
| کنسول زنده، پاور، فایل‌منیجر، TPS/CPU/RAM | پلاگین بریج، یا Pterodactyl |
| آمار بازیکن روی پروفایل | سینک بریج (PlaceholderAPI) |
| پرداخت واقعی | درگاه تنظیم‌شده (زیبال پیاده شده) |
| فونت‌های تجاری فارسی | فایل لایسنس‌دار تو `public/fonts/` |

بقیه‌ی چیزها — لاگین، دسترسی، اخبار، تیرها، کاتالوگ فروشگاه، Audit و وضعیت عمومی سرور — همین‌طوری کار می‌کنن.

---

## دیپلوی

یا `next build` + `next start` پشت nginx/caddy، یا Vercel. `vercel.json` ریجن `syd1` و کرون روزانه رو ست کرده.

چک‌لیست:

1. دیتابیس در دسترس باشه؛ `prisma/schema.prisma` اعمال بشه (برای تغییرات اضافه، `prisma/manual/*.sql`).
2. `SESSION_SECRET` و `JWT_SECRET` واقعی بذار.
3. `SETUP_KEY` رو ست کن، `/setup` رو تموم کن، بعد کلید رو بردار.
4. `PAYMENT_PROVIDER_CALLBACK_BASE` رو بذار روی همون دامنه‌ای که درگاه قبول داره.
5. اگه خودت کرون ساعتی می‌زنی، `CRON_SECRET` یادت نره.

مرحله‌به‌مرحله (با نکته‌ی پول‌ر Supabase): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

---

## ساختار پروژه

```
prisma/
  schema.prisma          # ۳۴ مدل
  seed.ts                # نقش، مجوز، تیر، کاتالوگ (بدون آمار الکی)
  manual/                # SQL اضافه‌ای برای تغییرات روی دیتابیس زنده
src/lib/                 # auth، دسترسی، audit، تنظیمات، پرداخت، رنک، استودیو، تلگرام
src/lib/mc/              # آداپترها: بریج، pterodactyl، rcon، slp، سندباکس فایل
src/app/                 # صفحات عمومی، داشبورد، ادمین، مالک، دولوپر، تستر
src/app/api/             # APIها
deploy/zibal-relay/      # رله‌ی PHP برای درگاهی که دامنه‌ی کال‌بک رو قفل کرده
docs/                    # معماری، دیپلوی، ماینکرفت، پرداخت
```

---

## امنیت

- پسوردها Argon2id؛ نه لاگ می‌شن نه برمی‌گردن نه نمایش داده می‌شن.
- سشن‌ها توکن تصادفی‌ان و هش‌شده ذخیره می‌شن؛ کوکی HttpOnly + SameSite.
- دسترسی‌ها سمت سرور چک می‌شن؛ UI فقط دکمه رو قایم می‌کنه.
- محدودیت نرخ برای لاگین و API.
- فایل‌منیجر سندباکسه: `..`، درایو لتر و سیملینک بیرون‌رو رد می‌شن.
- هدرهای امنیتی (CSP، `X-Frame-Options`، `nosniff`، `Referrer-Policy`) از middleware.
- سکرت‌ها فقط تو `.env`.

چیزی پیدا کردی؟ [SECURITY.md](SECURITY.md) — لطفاً خصوصی بگو، نه تو Issue عمومی.

---

## اسکرین‌شات

_عکس‌ها رو بذار تو `docs/screenshots/` و همین‌جا لینکشون کن: صفحه‌ی اصلی، تیرها، فروشگاه، داشبورد، کنسول._

---

## ریپوهای مرتبط

| ریپو | چیه |
|---|---|
| [`tcc-bridge`](https://github.com/pnbx/tcc-bridge) | پلاگین Paper که وضعیت می‌فرسته و دستور می‌گیره |
| [`tcc-bot`](https://github.com/pnbx/tcc-bot) | ربات تلگرام و مینی‌اپ برای تیم و بازیکن‌ها |
| [`TCC-Launcher`](https://github.com/pnbx/TCC-Launcher) | لانچر کلاینت TCC |
| `tcc-skript` | محتوای بتل‌پس، کازمتیک و کوئست سرور |

---

## لایسنس

[MIT](LICENSE) © TCC Minecraft

فونت‌های داخل `public/fonts/` لایسنس خودشون رو دارن (Vazirmatn و Estedad OFL هستن). Peyda و Dana و Yekan Bakh تجاری‌ان و **توی ریپو نیستن** — اگه لایسنسشون رو داری خودت اضافه کن.
