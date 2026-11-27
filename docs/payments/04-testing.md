# 4-босқич — Тестлар (2026-11-27)

| Текширув | Натижа |
|---|---|
| `tsc --noEmit` | 0 хато |
| `vitest run` | 74 ўтди, 6 ўтказилди (интеграция — тест база + ишлаб турган сервер керак), 0 ўтмади |
| SQL 1b регрессия (1c дан кейин, тест база) | 43/43 |
| SQL 1c (тест база) | 38/38 |
| Тест база ўзгармади | буюртма 0, чек 0, карта 0 (ҳамма текширув rollback) |
| `next build` | муваффақиятли |
| Production сборка | `/demo` → 404; `/admin/tolovlar` → логинга (307); `/api/payments/orders/*` ва `/api/admin/monetization/payments` → 401 |
| Базасиз локал сайт | `/`, `/kabinet`, `/kabinet/tolov/*`, `/admin/login` → 200; монетизация ўчиқ — эски форма ишлайди |
| Браузер (Demo) | Premium 120 000, TOP йўқ; чек → админ тасдиғи → модерация → Premium белгиси; рад этиш → қайтариш алоҳида, тўлов `paid` |
| Браузер (мобил 375px) | `/kabinet/tolov/*` — горизонтал сурилиш йўқ, авторизациясиз маълумот кўринмайди |
| Network | Supabase ёки Telegram Bot API'га сўров йўқ |

## Ҳали синалмаган (сабаби)
- **Реал backend'нинг браузер орқали тўлиқ E2E синови** (мижоз чек юклайди → админ `/admin/tolovlar` да тасдиқлайди) — тест базанинг `service_role` калити локал `.env.test.local` да йўқ. SQL даражасида ҳамма қоида синалди; Next.js сервери орқали синов калит қўйилгандан кейин қилинади.
- Telegram Mini App ичида — ҳақиқий Telegram муҳити керак.

## `.env.test.local` ни тайёрлаш (калитни чатга юборманг)
1. Supabase Dashboard → `angren-estate-test` → Project Settings → API.
2. Лойиҳа папкасида `.env.test.local` файлини яратинг (у `.gitignore` да: `.env*.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://lesaumhlzjagrcfvjqqf.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role / secret key>
   TEST_DATABASE=1
   ```
3. Текширув: `git check-ignore .env.test.local` — файл номи чиқиши керак.
4. `.env.local` (production) ни бу ишда ишлатманг: `next dev` production базага уланишни рад этади.
