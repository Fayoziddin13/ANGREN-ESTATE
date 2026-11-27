# 0-босқич — Тўлов тизими аудити

Сана: 2026-11-27. Branch: `claude/manual-card-payment` (`claude/monetization` устидан).
Аудит вақтида код, production ва Supabase ўзгартирилмади.

## 1. Ҳозирги ҳолат

| Қатлам | Ҳолат |
|---|---|
| Production Supabase (`gemozzkmoogjxtdwvepz`) | Монетизация жадваллари **йўқ** (`supabase/baseline/production_schema_2026-11-26.sql` да `payment_orders`, `listing_submissions`, `customer_accounts` учрамайди). |
| Тест Supabase (`lesaumhlzjagrcfvjqqf`, angren-estate-test) | `baseline`, `1a_accounts`, `1b_listings_payments` қўлланган. Буюртма/ариза йўқ. Нархлар: эълон 50 000, статуслар 3/7/30 кун. `storage.objects` да policy йўқ (ҳамма файл фақат service role орқали). |
| Server коди (`src/lib/monetization/*`, `/api/...`) | 1a/1b устида ишлайди. Тўлов провайдери — фақат локал **Mock** (бир зумда тўлайди). Қўлда карта тўлови **йўқ**. |
| Local Demo (`/demo`, `src/lib/demo/*`) | Қўлда карта тўлови симуляцияси, `localStorage` да. |
| `.env.test.local` | Йўқ. Тест базасининг `service_role` калити керак (5-бўлимга қаранг). |

## 2. Premium тарифи

- **Demo:** `Premium (TOP 7 kun bilan)` — 120 000, тасдиқда TOP 7 кун автоматик берилади
  (`src/lib/demo/engine.ts:325`, `:897-905`; тест `tests/unit/demoEngine.test.ts:273`). **Қоидага зид** — TOP Premium'га кирмаслиги керак.
- **Реал backend (1a/1b):** Premium тушунчаси **йўқ**: `pricing_plans` да эълон учун битта нарх (`service='listing'`).
- `TelegramContext.tsx:104`, `telegramServer.ts:25` даги `is_premium` — Telegram Premium фойдаланувчи белгиси, тарифга алоқаси йўқ.
- Хулоса: Premium'нинг TOP'дан бошқа имконияти кодда йўқ. Янги қоида: Premium = нарх 120 000 + Premium белгиси + админ белгилаган имкониятлар рўйхати, TOP алоҳида.

## 3. Топилган муаммолар

### Critical (реал пулга тўсиқ)
- **C1** Demo'да барча ҳолат ва роллар `localStorage` да — браузердан ўзгартириш мумкин (`src/lib/demo/store.ts`, `engine.ts:282-288`).
- **C2** Demo чеклари `localStorage` да, ҳақиқий ҳимоя йўқ.
- **C3** Реал backend'да қўлда карта тўлови йўқ: `payment_orders.status` = `PENDING/PAID/FAILED/CANCELLED/REFUNDED`, чек ва карта жадвали йўқ, провайдер — Mock (`1b...sql:130-165`, `src/lib/monetization/payments.ts`).

### High
- **H1** Premium'га TOP кирган (2-бўлим).
- **H2** Demo: промокод лимити тасдиқда текширилмайди — лимит 1 бўлган код 2 марта ишлатилди (`engine.ts:421-435`, `:533-539`). Реал backend'да `promo_redemptions` захираси бор — муаммо фақат demo'да.
- **H3** Demo: эълон рад этилгач статус буюртмаси тўланса — пул олинади, қайтариш очилмайди (`engine.ts:924-929`, `:751-766`).

### Medium
- **M1** Тўлов ва қайтариш ҳолатлари аралашган: demo'да `paymentStatus` ичида `refund_*`; реал backend'да `mon_settle_refund` буюртмани `REFUNDED` қилади (`1b...sql:828-830`).
- **M2** Барча админ ҳаракати журналга ёзилмайди (demo: `togglePromo`, `togglePromotion`, `shiftClock`; журнал 200 қатор).
- **M3** Буюртма қайси карта кўрсатилганини эсламайди.
- **M4** Такрорий чек фақат айнан бир хил файл бўлса аниқланади.
- **M5** Demo engine чек ҳажмини текширмайди.
- **M6** Тасдиқланган эълон рад этилса, фаол пуллик статус учун қайтариш очилмайди.
- **M7** Демо саҳифалар ҳам `telegram.org` скриптини (`src/app/layout.tsx:58`) ва валюта API'ларини (`src/app/api/currency/route.ts:20,45`) юклайди.
- **M8** Demo: бир нечта вкладкада охирги ёзув олдингисини ўчириши мумкин.
- **M9** Реал backend: буюртма муддати 30 дақиқа (`mon_settings.order_ttl_minutes`) — банк ўтказмаси ва чек учун жуда қисқа.
- **M10** Реал backend: промокод ва акция бирга қўлланмайди (каттаси ютади), demo'да эса кетма-кет қўлланади — икки хил қоида.

### Low
- **L1** PNG чек JPEG'га қайта кодланади, `mime` нотўғри. **L2** `statusPhase` бошланиш вақтини эътиборсиз қолдиради.
- **L3** Монетизация ўчиқ пайтдаги эълон бепул ҳуқуқни ишлатади. **L4** «Қўшимча маълумот сўралди» алоҳида ҳолат эмас.
- **L5** `localStorage` чегараси (~5 MB). **L6** Reset demo журналини ҳам ўчиради.

## 4. Тестлар (аудит вақтида)
- Ўтди: 66 (demoEngine 28, monetization 15, safety 13, nextConfigGuard 6, propertiesLocalMirror 4). tsc — 0 хато.
- Ўтказиб юборилди: 6 (`tests/integration/api-flow.test.ts` — тест база ва ишлаб турган сервер керак).
- Ўтмади: 0. Аммо `demoEngine.test.ts:273` нотўғри қоидани (Premium + TOP) тасдиқлайди.
- Браузер: Supabase / Telegram Bot API'га сўров йўқ; Reset фақат `angren_demo_v1` ни тозалайди.

## 5. Мақсадли архитектура (1–3-босқичлар)
- `payment_orders.status` фақат тўлов: `PENDING` (тўлов кутилмоқда) → `RECEIPT_SUBMITTED` → `UNDER_REVIEW` → `PAID` / `REJECTED` / `INFO_REQUESTED`, ёки `CANCELLED`/`FAILED`. `REFUNDED` энди ўрнатилмайди.
- Қайтариш фақат `refunds` жадвалида (`REQUESTED → … → MANUAL_CONFIRMED`).
- Янги: `payment_methods` (карта, тарихи сақланади), `payment_receipts` (`sha256 UNIQUE`, private storage), `payment_reviews` (append-only админ қарорлари).
- Premium: `pricing_plans.listing_tier` (`standard`/`premium`), `listing_submissions.listing_tier`, Premium имкониятлари админ созламасида.
- Барча функциялар service role орқали, RLS ёқилган, anon/authenticated га ҳуқуқ йўқ; админ ҳуқуқи серверда (`/api/admin/*` middleware).
