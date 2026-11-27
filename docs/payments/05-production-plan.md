# 5-босқич — Production'га жорий қилиш режаси (рухсат кутилмоқда)

Production'га ҳеч нарса қўлланмаган. Қуйидаги ҳар бир қадам **сизнинг аниқ рухсатингиз** билан бажарилади.

## Олдиндан шартлар
1. **Backup:** Supabase Dashboard → production → Database → Backups: охирги кунлик backup бор ва (иложи бўлса) PITR ёқилган. Тиклаш имкониятини тасдиқланг.
2. **Тест муҳитида тўлиқ E2E:** `.env.test.local` га тест калити қўйилгач, мижоз → чек → админ тасдиғи → модерация сценарийини браузерда ўтказиш.
3. **Ҳақиқий карта:** production админ панелида `/admin/tolovlar` → «To‘lov kartasi» га ҳақиқий карта киритилади (кодда карта йўқ).

## Миграциялар (production'да ҳали монетизация жадваллари йўқ)
Тартиб: `20261126150000_monetization_1a_accounts` → `20261126160000_monetization_1b_listings_payments` → `20261127120000_monetization_1c_manual_card_premium`.
- Ҳаммаси қўшимча: янги жадваллар/функциялар/битта ёпиқ bucket; мавжуд жадваллар ўзгармайди (1b `properties.id` га `ON DELETE SET NULL` билан боғланади).
- Монетизация сукут бўйича **ўчиқ** (`mon_settings.enabled = false`) — миграциядан кейин сайт эскича ишлайди.
- Қўллашдан олдин: production схемаси baseline (`supabase/baseline/production_schema_2026-11-26.sql`) билан солиштирилади.
- Қўллагандан кейин: 1a/1b/1c текширувлари **фақат тест базада**; production'да фақат ўқиш (жадваллар бор, RLS ёқилган, anon ҳуқуқи йўқ).

## Код
1. `claude/manual-card-payment` → GitHub'га push → Pull Request → Vercel Preview.
2. Preview'да: демо 404, сайт эскича, админ саҳифалари логин сўрайди.
3. `main` га merge → Vercel production deploy.
4. Админ монетизацияни ёқади, кейин Standart/Premium нархларини ва картани текширади.

## Қайтариш режаси
- Код: Vercel'да олдинги deploy'га «Promote».
- База: монетизацияни ўчириш (`enabled=false`) етарли; rollback SQL фақат тўлов маълумоти йўқ бўлса ишлайди.
