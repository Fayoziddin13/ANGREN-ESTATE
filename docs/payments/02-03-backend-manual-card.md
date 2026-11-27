# 2–3-босқичлар — Реал backend ва картадан картага тўлов

Faqat **тест** Supabase (`lesaumhlzjagrcfvjqqf`) да қўлланди. Production'га тегилмади.

## Маълумотлар базаси — `supabase/migrations/20261127120000_monetization_1c_manual_card_premium.sql`

| Объект | Вазифаси |
|---|---|
| `payment_methods` | Админ киритган карта. Ўзгартирилса янги қатор, эскиси тарихда. Бир вақтда битта фаол. |
| `payment_receipts` | Чеклар. `sha256 UNIQUE` — бир чек бир марта. Файл `payment-receipts` ёпиқ bucket'да. Ҳар бир чекда кўрсатилган карта (охирги 4 рақам) сақланади. |
| `payment_reviews` | Админ қарорлари (`started / approved / rejected / info_requested`). Фақат қўшиш мумкин, таҳрир/ўчириш тақиқланган. |
| `payment_orders.status` | Фақат тўлов: `PENDING → RECEIPT_SUBMITTED → UNDER_REVIEW → PAID / REJECTED / INFO_REQUESTED`, `CANCELLED`, `FAILED`. `REFUNDED` энди ёзилмайди. |
| `refunds` | Қайтариш фақат шу ерда (`REQUESTED → MANUAL_REQUIRED → MANUAL_CONFIRMED` + банк референси). Тўлов `PAID` бўлиб қолади. |
| `listing_tier` | `pricing_plans` ва `listing_submissions` да `standard / premium`. Premium 120 000, ҳеч қачон бепул эмас, TOP бермайди. |

Функциялар (фақат `service_role`): `mon_submit_receipt`, `mon_review_payment` (қатор блокировкаси, бир марта тасдиқ, хизмат ёпилган бўлса автоматик қайтариш), `mon_set_payment_method`.
Ўзгарган: `mon_quote`, `mon_listing_terms`, `mon_submit_listing`, `mon_set_price` (тариф параметри), `mon_ensure_*_order`, `mon_close_order`, `mon_cancel_*` (чек текширилаётганда бекор қилиб бўлмайди), `mon_settle_refund` (тўловга тегмайди), `mon_settings` (буюртма 48 соат яшайди).

Rollback: `supabase/rollback/...1c...down.sql` — 1b функцияларини айнан тиклайди, тўлов маълумоти бор бўлса **ишламайди** (маълумот йўқолмаслиги учун).

## Сервер ва интерфейс

- Мижоз: `/kabinet/tolov/<buyurtma>` — сумма, карта (фақат тўлаш мумкин бўлганда), чек юклаш (JPG/PNG/PDF, 10 MB, тури байтлардан), бекор қилиш, ҳолат ва админ изоҳи. Эълон формасида Standart / Premium танлови.
- API: `GET/DELETE /api/payments/orders/[id]`, `POST /api/payments/orders/[id]/receipt` (мижоз ўз буюртмаси); `/api/admin/monetization/payments`, `.../payments/<id>`, `.../payments/<id>/review`, `.../payment-method` (фақат админ cookie — middleware).
- Админ: `/admin/tolovlar` — текширишдаги чеклар (5 дақиқалик signed URL), тасдиқлаш (тасдиқ сўралади), рад этиш/қўшимча сўраш (сабаб мажбурий), карта, Standart/Premium нархлари, Premium имкониятлари (TOP ёзиб бўлмайди).
- Тасдиқланган Premium эълонга `premium` белгиси қўйилади (TOP эмас). Тўлов провайдери уланмаган; қайтаришни админ банк орқали қилиб, референс билан тасдиқлайди.

## Хавфсизлик
- Браузер калитлари (anon/authenticated) янги жадвал ва `mon_*` функцияларга ҳуқуққа эга эмас — фойдаланувчи тўловни `paid` қила олмайди.
- `service_role` фақат серверда (`src/lib/supabaseServer.ts`), браузерга юборилмайди.
- Чек файлларига storage policy йўқ — фақат сервер; админ қисқа муддатли ҳавола орқали кўради.
