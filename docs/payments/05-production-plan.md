# 5-босқич — Production'га жорий қилиш

## Бажарилди (2026-11-27)
1. **Backup** — production Free планда, Supabase backup йўқ. Шунинг учун қўлда `pg_dump -Fc` олинди (`public`, `auth`, `storage`), 49 жадвал, қаторлар сони production билан бир хил. Файл ва SHA-256 лойиҳадан ташқарида: `C:\Users\home\angren-estate-backups\` (README.txt ичида тиклаш йўриқномаси). Вақтинчалик backup роли ўчирилган.
2. **Миграциялар production'га қўлланди** (`gemozzkmoogjxtdwvepz`, сизнинг «Ҳа, қўлла» рухсатингиз билан):
   `monetization_1a_accounts` → `monetization_1b_listings_payments` → `monetization_1c_manual_card_premium`.
3. **Текширув (фақат ўқиш):**
   - мавжуд маълумот ўзгармади: `properties` 25, `storage.objects` 195, `auth.users` 3, `app_settings` 11, `leads` 4, `analytics_events` 2872;
   - 17 янги жадвал, ҳаммасида RLS ёқилган, policy йўқ, anon/authenticated ҳуқуқи йўқ; 30 `mon_*` функцияси — anon/authenticated бажара олмайди;
   - устунлар, чекловлар, индекслар, триггерлар ва ҳуқуқлар тест база билан **айнан бир хил** (md5 солиштирилди); 4 функцияда фарқ фақат изоҳ (comment) сатрларида, мантиқ бир хил;
   - монетизация **ўчиқ** (`enabled=false`) — сайт эскича ишлайди;
   - нархлар: фақат Premium 120 000 (сид). Standart ва стикер нархлари ҳали йўқ;
   - bucket'лар: `listing-submissions` ва `payment-receipts` ёпиқ, `property-images` аввалгидек очиқ;
   - Security Advisor: янги жадваллар бўйича фақат «RLS on, policy йўқ» (атайлаб). Қолган огоҳлантиришлар (`is_admin`, `rls_auto_enable`, `postgis`, `spatial_ref_sys`, leaked password protection) аввалдан бор эди.

## Қолган қадамлар (ҳар бири алоҳида рухсат билан)
1. `claude/manual-card-payment` → GitHub'га push → Pull Request → Vercel Preview.
2. Preview'да: демо 404, сайт эскича, админ саҳифалари логин сўрайди.
3. `main` га merge → Vercel production deploy.
4. Админ `/admin/tolovlar` да ҳақиқий картани киритади, Standart (ва керак бўлса стикер) нархларини белгилайди, кейин монетизацияни ёқади.
5. Telegram Mini App ичида текшириш.

## Қайтариш режаси
- Код: Vercel'да олдинги deploy'га «Promote».
- База: монетизацияни ўчириш (`enabled=false`) етарли. Rollback SQL (`supabase/rollback/`) фақат тўлов маълумоти йўқ бўлса ишлайди.
- Тўлиқ тиклаш: юқоридаги `pg_dump` файлидан (README.txt).
