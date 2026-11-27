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

## Реал backend E2E (тест база + локал сервер, 2026-11-27)
| Сценарий | Натижа |
|---|---|
| Админ тест картасини киритади, Premium'га «TOP» ёзиш | карта сақланди; TOP → 400 |
| Мижоз: биринчи Standart эълон | бепул, модерацияга |
| Мижоз: Premium эълон | 120 000, `/kabinet/tolov/<id>` да тест картаси кўринди |
| Сохта файл (HTML'ни .png деб) | рад этилди |
| PNG чек → админ очди | «текширувга олинди», чек 5 дақиқалик signed URL орқали кўринди |
| Админ сабаб билан рад этди | мижоз сабабни кўрди; худди шу чек қайта → рад этилди |
| Янги PDF чек → админ тасдиқлади | PAID, эълон модерацияда (сайтда эмас), TOP яратилмади, 1 тўлов ёзуви |
| Иккинчи тасдиқ | 409 `already_paid` |
| Модерацияда тасдиқ | қоралама объект, белги `premium`, TOP йўқ |
| Пуллик эълон рад этилди → қайтариш | MANUAL_REQUIRED → референссиз 400 → референс билан MANUAL_CONFIRMED; тўлов PAID қолди |
| Хавфсизлик | anon REST/RPC 401, мижоз `PAID` қилишга уринса 403, бошқа мижоз буюртмаси 404, админ API 401, чекнинг очиқ URL'и 400 |
| Интеграция тестлари (`tests/integration`) | 7/7 |

E2E давомида топилган ва тузатилган хато: ариза ва статус API'лари ҳали Mock провайдер шартини текширарди, шунинг учун тўлов саҳифасига ўтказмасди.

Ҳали синалмаган: Telegram Mini App ичида (ҳақиқий Telegram муҳити керак).

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
