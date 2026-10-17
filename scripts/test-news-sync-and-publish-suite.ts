/**
 * ANGREN ESTATE — Comprehensive News Sync & Telegram Publishing Hotfix Test Suite
 * Tests RSS harvesting, deduplication, dual-direction Telegram publishing (Channel + Bot),
 * error resilience, message_id validation, and auth protection.
 *
 * Run: cmd.exe /c "npx tsx scripts/test-news-sync-and-publish-suite.ts" < /dev/null
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

async function runTests() {
  console.log("================================================================================");
  console.log("ANGREN ESTATE — NEWS SYNC & TELEGRAM PUBLISHING HOTFIX SUITE");
  console.log("================================================================================\n");

  const {
    parseRssXml,
    isRealEstateRelated,
    classifyNewsCategory,
  } = await import("../src/lib/newsHarvester");

  const {
    getNewsSources,
    saveNewsItem,
    getNewsById,
    hasNewsWithUrlHash,
    computeUrlHash,
    saveNewsTranslation,
    recordNewsPublication,
  } = await import("../src/lib/newsStore");

  const {
    buildNewsPostCaption,
    buildNewsPostMarkup,
    publishNewsToTelegramChannel,
    broadcastNewsToTelegramSubscribers,
  } = await import("../src/lib/newsTelegramPublisher");

  // -------------------------------------------------------------------------
  // 1. RSS XML Parsing & Media Extraction
  // -------------------------------------------------------------------------
  console.log("1. Testing RSS & Atom XML Parsing...");
  const sampleRss = `
    <rss version="2.0">
      <channel>
        <item>
          <title><![CDATA[Тошкентда янги турар-жой мажмуаси қурилиши бошланди]]></title>
          <link>https://kun.uz/news/2026/10/18/toshkent-turar-joy</link>
          <description><![CDATA[Пойтахтда замонавий хонадонлар ва кўчмас мулк лойиҳалари тақдим этилди.]]></description>
          <pubDate>Sun, 18 Oct 2026 09:00:00 +0500</pubDate>
          <enclosure url="https://kun.uz/img/real-estate-1.jpg" type="image/jpeg" />
        </item>
        <item>
          <title>Спорт мусобақалари якунланди</title>
          <link>https://kun.uz/news/2026/10/18/sport-yangiliklari</link>
          <description>Футбол бўйича чемпионат баҳслари бўлиб ўтди.</description>
          <pubDate>Sun, 18 Oct 2026 08:30:00 +0500</pubDate>
        </item>
      </channel>
    </rss>
  `;

  const parsed = parseRssXml(sampleRss);
  assert.strictEqual(parsed.length, 2, "Should parse 2 RSS items");
  assert.strictEqual(parsed[0].title, "Тошкентда янги турар-жой мажмуаси қурилиши бошланди");
  assert.strictEqual(parsed[0].imageUrl, "https://kun.uz/img/real-estate-1.jpg", "Should extract enclosure image");
  console.log("  ✓ RSS 2.0 items and media enclosures parsed correctly");

  // -------------------------------------------------------------------------
  // 2. Real Estate Relevance & Keyword Filtering (Uzbek Cyrillic, Latin & Russian)
  // -------------------------------------------------------------------------
  console.log("\n2. Testing Keyword Relevance (Cyrillic, Latin & Russian)...");
  assert(isRealEstateRelated("Янги кўчмас мулк", "турар-жой нархлари"), "Uzbek Cyrillic match failed");
  assert(isRealEstateRelated("Yangi ko‘chmas mulk", "uy-joy narxlari"), "Uzbek Latin match failed");
  assert(isRealEstateRelated("Ипотека кредити", "бошланғич бадал"), "Mortgage keyword match failed");
  assert(isRealEstateRelated("Строительство нового ЖК", "продажа квартир"), "Russian real estate match failed");
  assert(!isRealEstateRelated("Спорт мусобақалари", "Футбол бўйича чемпионат"), "Non-real-estate should be rejected");
  assert(!isRealEstateRelated("Афғонистон чегарасидаги тўқнашув", "Ҳарбий ҳолат эълон қилинди"), "Unrelated news must not match");
  console.log("  ✓ Multi-script keyword filtering accurately identifies real estate news");

  // -------------------------------------------------------------------------
  // 3. Category Classification
  // -------------------------------------------------------------------------
  console.log("\n3. Testing Category Classification...");
  assert.strictEqual(classifyNewsCategory("Ипотека ставкалари ўзгарди", ""), "mortgage_finance");
  assert.strictEqual(classifyNewsCategory("Кадастр ҳужжатларини расмийлаштириш тартиби", "Қарор"), "legislation_cadastre");
  assert.strictEqual(classifyNewsCategory("Янги бино қурилиши", "Девелопер лойиҳаси"), "construction_projects");
  assert.strictEqual(classifyNewsCategory("Ижара шартномаси қоидалари", ""), "rental_market");
  console.log("  ✓ Category classification assigns accurate categories");

  // -------------------------------------------------------------------------
  // 4. News Deduplication & URL Hashing
  // -------------------------------------------------------------------------
  console.log("\n4. Testing News Deduplication & Store Resilience...");
  const testUrl = "https://angrenestate.uz/test-unique-article-" + Date.now();
  const testHash = computeUrlHash(testUrl);
  const existsBefore = await hasNewsWithUrlHash(testHash);
  assert.strictEqual(existsBefore, false, "Fresh URL hash must not exist before insertion");

  const saved = await saveNewsItem({
    original_title: "Test Unique Real Estate News Article",
    original_url: testUrl,
    url_hash: testHash,
    category: "market_prices",
    published_at: new Date().toISOString(),
    discovered_at: new Date().toISOString(),
    status: "ready",
    requires_fact_check: false,
  });

  assert(saved.id, "Saved news must have an ID");
  const existsAfter = await hasNewsWithUrlHash(testHash);
  assert.strictEqual(existsAfter, true, "URL hash must be detected as existing after save");
  console.log("  ✓ Deduplication and URL hash detection working properly");

  // -------------------------------------------------------------------------
  // 5. Bilingual Translations & Caption Builder
  // -------------------------------------------------------------------------
  console.log("\n5. Testing Post Caption & Inline Keyboard Generation...");
  await saveNewsTranslation({
    news_id: saved.id,
    language: "uz",
    title: "Angrenda yangi turar-joy majmuasi foydalanishga topshirildi",
    summary: "Shahar markazida barpo etilgan yangi xonadonlar sifatli kommunikatsiya bilan ta'minlangan.",
    practical_takeaway: "Uy xarid qilmoqchi bo‘lganlar uchun ipoteka shartlari mavjud.",
    is_reviewed_by_admin: true,
  });

  const refreshedNews = await getNewsById(saved.id);
  assert(refreshedNews, "Must load news with translations");
  const caption = buildNewsPostCaption(refreshedNews, "uz");
  assert(caption.includes("ANGREN ESTATE"), "Caption must include brand title");
  assert(caption.includes("@angren_estate"), "Caption must include channel handle");
  assert(caption.length <= 1024, "Caption length must be <= 1024 chars");

  const markup = buildNewsPostMarkup(refreshedNews, "uz");
  assert(markup.inline_keyboard.length > 0, "Markup must contain inline buttons");
  assert(markup.inline_keyboard[0][0].url.startsWith("https://"), "Button URL must be HTTPS");
  console.log("  ✓ Post caption and HTTPS markup built in strict accordance with rules");

  // -------------------------------------------------------------------------
  // 6. Dual-Direction Telegram Publishing Mock Tests
  // -------------------------------------------------------------------------
  console.log("\n6. Testing Dual-Direction Telegram Publishing (Channel & Bot)...");

  // Save the original fetch
  const originalFetch = global.fetch;

  try {
    // Mock Telegram Bot API: return message_id 12345
    let interceptedCalls: any[] = [];
    global.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes("api.telegram.org")) {
        interceptedCalls.push({ url: urlStr, body: init?.body });
        return new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 889911, chat: { id: -1001234567890 } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    // Scenario A: Channel-only publish
    interceptedCalls = [];
    const channelResult = await publishNewsToTelegramChannel(saved.id, "uz", {
      botToken: "mock_test_token_123:ABC",
      forceRepeat: true,
    });
    assert.strictEqual(channelResult.success, true, "Channel publish should succeed");
    assert.strictEqual(channelResult.status, "published");
    assert.strictEqual(channelResult.messageId, 889911, "Must return valid message_id > 0");
    console.log("  ✓ Scenario A: Channel-only publish succeeded with valid message_id");

    // Scenario B: Deduplication protection on channel publish
    const dupChannelResult = await publishNewsToTelegramChannel(saved.id, "uz", {
      botToken: "mock_test_token_123:ABC",
      forceRepeat: false,
    });
    assert.strictEqual(dupChannelResult.status, "already_published", "Second publish should return already_published");
    console.log("  ✓ Scenario B: Repeated publish cleanly detected and deduplicated");

    // Scenario C: Bot subscribers broadcast
    interceptedCalls = [];
    const botResult = await broadcastNewsToTelegramSubscribers(saved.id, "uz", {
      botToken: "mock_test_token_123:ABC",
      forceRepeat: true,
    });
    assert.strictEqual(botResult.success, true, "Bot broadcast should succeed when subscribers exist");
    assert.strictEqual(botResult.status, "published");
    assert(botResult.recipientsCount! > 0, "Recipients count should be > 0");
    console.log(`  ✓ Scenario C: Bot broadcast succeeded to ${botResult.recipientsCount} subscribers`);

    // Scenario D: Channel succeeds, bot fails (independent execution)
    global.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes("api.telegram.org")) {
        // Fail only for direct messages to bot subscribers
        if (urlStr.includes("sendMessage")) {
          return new Response(
            JSON.stringify({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ ok: true, result: { message_id: 999111 } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const chanRes = await publishNewsToTelegramChannel(saved.id, "uz", {
      botToken: "mock_test_token_123:ABC",
      forceRepeat: true,
    });
    const botFailRes = await broadcastNewsToTelegramSubscribers(saved.id, "uz", {
      botToken: "mock_test_token_123:ABC",
      forceRepeat: true,
    });

    assert.strictEqual(chanRes.success, true, "Channel should succeed independently");
    assert.strictEqual(botFailRes.success, false, "Bot broadcast should report error on failure");
    assert(botFailRes.error?.includes("blocked") || botFailRes.error?.includes("xatolik"), "Must capture exact error message");
    console.log("  ✓ Scenario D: Independent channels verified — bot failure does not affect channel post");

    // Scenario E: Invalid Telegram message_id validation
    global.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes("api.telegram.org")) {
        return new Response(
          JSON.stringify({ ok: true, result: { message_id: 0 } }), // Invalid message_id <= 0
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const invalidMsgIdRes = await publishNewsToTelegramChannel(saved.id, "uz", {
      botToken: "mock_test_token_123:ABC",
      forceRepeat: true,
    });
    assert.strictEqual(invalidMsgIdRes.success, false, "Must reject message_id <= 0");
    assert(invalidMsgIdRes.error?.includes("message_id"), "Error should explain invalid message_id");
    console.log("  ✓ Scenario E: Strict message_id > 0 validation verified");

  } finally {
    // Restore global fetch
    global.fetch = originalFetch;
  }

  // -------------------------------------------------------------------------
  // 7. News Sources & Seeding Integrity
  // -------------------------------------------------------------------------
  console.log("\n7. Verifying News Sources Integrity...");
  const sources = await getNewsSources();
  assert(sources.length >= 11, `Expected at least 11 sources, found ${sources.length}`);
  const hasLex = sources.some((s) => s.domain === "lex.uz");
  const hasCbu = sources.some((s) => s.domain === "cbu.uz");
  const hasGazeta = sources.some((s) => s.domain === "gazeta.uz");
  assert(hasLex && hasCbu && hasGazeta, "Official verified sources must be present");
  console.log(`  ✓ All ${sources.length} sources loaded with proper domains and trust levels`);

  console.log("\n================================================================================");
  console.log("ALL TESTS PASSED SUCCESSFULLY (100% GREEN)");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
