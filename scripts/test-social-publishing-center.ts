/**
 * ANGREN ESTATE — REAL ESTATE NEWS & SOCIAL PUBLISHING CENTER TEST SUITE
 * Tests:
 * 1. RSS XML parsing and HTML entity sanitization
 * 2. Category classification and real estate keyword filtering
 * 3. Verified numerical stat extraction
 * 4. Bilingual content and practical takeaway generation
 * 5. URL normalization and SHA-256 deduplication
 * 6. Brand SVG card generator validation (colors, fonts, layout)
 * 7. Telegram caption and inline keyboard markup compliance
 * 8. Mocked Telegram Channel and Bot publishing idempotency
 */

import {
  parseRssXml,
  cleanHtmlText,
  isRealEstateRelated,
  classifyNewsCategory,
  extractVerifiedStat,
  prepareBilingualNewsContent,
} from "../src/lib/newsHarvester";
import {
  computeUrlHash,
  saveNewsItem,
  getNewsById,
  recordNewsPublication,
} from "../src/lib/newsStore";
import { generateBrandCardSvg } from "../src/lib/newsVisualGenerator";
import {
  buildNewsPostCaption,
  buildNewsPostMarkup,
  publishNewsToTelegramChannel,
} from "../src/lib/newsTelegramPublisher";
import type { NewsSource, RealEstateNews } from "../src/lib/types/news";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

const mockSource: NewsSource = {
  id: "src-test-lex",
  name: "Lex.uz — Qonunchilik bazasi",
  domain: "lex.uz",
  feed_url: "https://lex.uz/rss",
  source_type: "rss",
  trust_level: "official_gov",
  check_frequency_min: 120,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function runSocialCenterTests() {
  console.log("\n=======================================================");
  console.log("REAL ESTATE NEWS & SOCIAL PUBLISHING CENTER TESTS");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // TEST 1: RSS XML Parsing and Sanitization
  // -------------------------------------------------------------
  console.log("--- 1. RSS XML Parsing & Sanitization ---");
  {
    const sampleXml = `
      <?xml version="1.0" encoding="utf-8"?>
      <rss version="2.0">
        <channel>
          <title>Test Real Estate Feed</title>
          <item>
            <title><![CDATA[Yangi turar joy majmualarida kadastr pasporti 7 kunda beriladi]]></title>
            <link>https://lex.uz/docs/8540162</link>
            <description><![CDATA[<p>Adliya vazirligi tomonidan <b>yangi tartib</b> tasdiqlandi &amp; kuchga kirdi.</p>]]></description>
            <pubDate>Fri, 16 Oct 2026 10:00:00 GMT</pubDate>
            <guid>/docs/8540162</guid>
            <enclosure url="https://lex.uz/media/sample.jpg" length="12345"/>
          </item>
          <item>
            <title>Oddiy sport yangiligi</title>
            <link>https://sample.uz/sport/123</link>
            <description>Futbol bo‘yicha O‘zbekiston chempionati natijalari</description>
            <pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const parsed = parseRssXml(sampleXml);
    assert(parsed.length === 2, "1.1: Successfully parsed 2 RSS items");
    assert(parsed[0].title === "Yangi turar joy majmualarida kadastr pasporti 7 kunda beriladi", "1.1: CDATA in title cleaned");
    assert(parsed[0].description.includes("Adliya vazirligi tomonidan yangi tartib tasdiqlandi & kuchga kirdi."), "1.1: HTML tags and entities cleaned in description");
    assert(parsed[0].imageUrl === "https://lex.uz/media/sample.jpg", "1.1: Enclosure image URL captured");
  }

  // -------------------------------------------------------------
  // TEST 2: Real Estate Filtering & Category Classification
  // -------------------------------------------------------------
  console.log("\n--- 2. Topic Filtering & Category Classification ---");
  {
    // Real estate relevance
    assert(isRealEstateRelated("Toshkentda uy-joy narxlari o‘sishi", "Birlamchi va ikkilamchi bozor") === true, "2.1: Detects uy-joy as real estate");
    assert(isRealEstateRelated("Yangi ipoteka subsidiyalari ajratiladi", "Markaziy bank va banklar stavkasi") === true, "2.1: Detects ipoteka as real estate");
    assert(isRealEstateRelated("Qurilish sohasida yangi standartlar", "Ko‘p qavatli bino developerlari") === true, "2.1: Detects qurilish & bino");
    assert(isRealEstateRelated("Barselona chempionlar ligasida g‘alaba qozondi", "Futbol matchi hisobi 3:1") === false, "2.2: Filters out sports news");

    // Category classification
    assert(classifyNewsCategory("Mulk huquqini davlat ro‘yxatidan o‘tkazish", "Kadastr agentligi nizomi") === "legislation_cadastre", "2.3: Categorizes legislation_cadastre");
    assert(classifyNewsCategory("Ipoteka kreditlari bo‘yicha foiz stavkalari", "Banklar subsidiyasi") === "mortgage_finance", "2.3: Categorizes mortgage_finance");
    assert(classifyNewsCategory("Yangi turar joy majmuasi qurilishi boshlandi", "Zarafshon ko‘chasidagi bino") === "construction_projects", "2.3: Categorizes construction_projects");
    assert(classifyNewsCategory("Toshkentda ijara narxlari tahlili", "Talabalar uchun arenda uylar") === "rental_market", "2.3: Categorizes rental_market");
    assert(classifyNewsCategory("Ko‘chmas mulk oldi-sotdisida davlat bojlari", "Soliq imtiyozlari") === "taxes_and_fees", "2.3: Categorizes taxes_and_fees");
  }

  // -------------------------------------------------------------
  // TEST 3: Verified Stat Extraction
  // -------------------------------------------------------------
  console.log("\n--- 3. Numerical Stat Extraction ---");
  {
    assert(extractVerifiedStat("Uy-joy narxlari o‘tgan chorakda 14.5% ga oshdi") === "14.5%", "3.1: Extracts percentage stat");
    assert(extractVerifiedStat("Kadastr pasporti endilikda 7 kunda beriladi") === "7 kunda", "3.2: Extracts time duration stat");
    assert(extractVerifiedStat("Kvadrat metrning o‘rtacha narxi $850 ga yetdi") === "$850", "3.3: Extracts price stat");
  }

  // -------------------------------------------------------------
  // TEST 4: Bilingual Content & Practical Takeaway
  // -------------------------------------------------------------
  console.log("\n--- 4. Bilingual Content & Practical Takeaways ---");
  {
    const feedItem = {
      title: "Kadastr pasportini berish muddati 7 kunga qisqartirildi",
      link: "https://lex.uz/docs/sample1",
      description: "Adliya vazirligi tomonidan yangi tartib tasdiqlandi. Hujjatlar 7 ish kuni ichida tayyorlanadi.",
      pubDate: new Date().toISOString(),
    };

    const content = await prepareBilingualNewsContent(feedItem, "legislation_cadastre", mockSource);
    assert(Boolean(content.uz.title), "4.1: Uzbek title prepared");
    assert(Boolean(content.uz.summary), "4.1: Uzbek summary prepared");
    assert(content.uz.takeaway.includes("Mulkdorlar va xaridorlar"), "4.1: Uzbek practical takeaway added");
    assert(Boolean(content.ru.title), "4.2: Russian title prepared");
    assert(Boolean(content.ru.takeaway), "4.2: Russian practical takeaway added");
    assert(content.statValue === "7 kunga", "4.3: Stat extracted correctly");
  }

  // -------------------------------------------------------------
  // TEST 5: Deduplication Hash Verification
  // -------------------------------------------------------------
  console.log("\n--- 5. URL Normalization & Deduplication Hash ---");
  {
    const url1 = "https://lex.uz/docs/8540162/";
    const url2 = "https://lex.uz/docs/8540162";
    const hash1 = computeUrlHash(url1);
    const hash2 = computeUrlHash(url2);

    assert(hash1 === hash2, "5.1: Normalized URLs produce identical SHA-256 hash");
    assert(hash1.length === 64, "5.1: Hash is valid SHA-256 hex string");

    const diffUrl = "https://lex.uz/docs/8540163";
    const diffHash = computeUrlHash(diffUrl);
    assert(diffHash !== hash1, "5.2: Different URLs produce distinct hashes");
  }

  // -------------------------------------------------------------
  // TEST 6: Brand Visual Card SVG Generator
  // -------------------------------------------------------------
  console.log("\n--- 6. Brand SVG Visual Card Generator ---");
  {
    const svgUz = generateBrandCardSvg({
      title: "Yangi uylarga kadastr rasmiylashtirish tartibi soddalashtirildi",
      category: "legislation_cadastre",
      sourceName: "Lex.uz",
      language: "uz",
      statValue: "7 KUN",
    });

    assert(svgUz.includes("viewBox=\"0 0 1200 675\""), "6.1: Generates 1200x675 dimensions (16:9)");
    assert(svgUz.includes("#0b3824") && svgUz.includes("#167d4f"), "6.1: Includes ANGREN ESTATE emerald brand colors");
    assert(svgUz.includes("ANGREN ESTATE"), "6.1: Contains brand title header");
    assert(svgUz.includes("QONUNCHILIK VA KADASTR"), "6.2: Contains category badge");
    assert(svgUz.includes("MUHIM RAQAM"), "6.3: Contains stat box header");
    assert(svgUz.includes("7 KUN"), "6.3: Contains verified stat value");
    assert(svgUz.includes("Manba: Lex.uz"), "6.4: Contains source credit");
    assert(svgUz.includes("angrenestate.uz"), "6.4: Contains domain watermark");
  }

  // -------------------------------------------------------------
  // TEST 7: Telegram Post Caption & Markup Compliance
  // -------------------------------------------------------------
  console.log("\n--- 7. Telegram Caption & Markup Compliance ---");
  {
    const testNews: RealEstateNews = {
      id: "news-test-001",
      source: mockSource,
      original_title: "Toshkentda ko‘chmas mulk narxlari o‘sishi sekinlashdi",
      original_url: "https://www.gazeta.uz/uz/2026/10/real-estate-prices",
      url_hash: computeUrlHash("https://www.gazeta.uz/uz/2026/10/real-estate-prices"),
      category: "market_prices",
      published_at: new Date().toISOString(),
      discovered_at: new Date().toISOString(),
      status: "ready",
      requires_fact_check: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      translations: {
        uz: {
          id: "t-uz",
          news_id: "news-test-001",
          language: "uz",
          title: "Toshkentda ko‘chmas mulk narxlari o‘sishi sekinlashdi",
          summary: "Markaziy bank sharhiga ko‘ra, poytaxtda narxlar barqarorlashuv bosqichiga o‘tmoqda.",
          practical_takeaway: "Bu holat xaridorlarga shoshilmasdan maqbul xonadon tanlash imkonini beradi.",
          is_reviewed_by_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ru: {
          id: "t-ru",
          news_id: "news-test-001",
          language: "ru",
          title: "Рост цен на недвижимость в Ташкенте замедлился",
          summary: "По данным обзора ЦБ, рынок столицы переходит в фазу ценовой стабилизации.",
          practical_takeaway: "Это позволяет покупателям взвешенно подойти к выбору жилья.",
          is_reviewed_by_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    };

    const captionUz = buildNewsPostCaption(testNews, "uz");
    assert(captionUz.includes("🏛 ANGREN ESTATE | Yangiliklar"), "7.1: Uzbek caption has brand header");
    assert(captionUz.includes("📌 Toshkentda ko‘chmas mulk narxlari o‘sishi sekinlashdi"), "7.1: Caption has title");
    assert(captionUz.includes("💡 O‘quvchi uchun ahamiyati:"), "7.1: Caption has practical takeaway prefix");
    assert(captionUz.includes("📰 Manba: Lex.uz"), "7.1: Caption has source credit");
    assert(captionUz.includes("@angren_estate"), "7.1: Caption has official channel handle");
    assert(captionUz.length <= 1024, `7.1: Caption length (${captionUz.length}) is within Telegram 1024 limit`);

    const captionRu = buildNewsPostCaption(testNews, "ru");
    assert(captionRu.includes("🏛 ANGREN ESTATE | Новости"), "7.2: Russian caption has Russian brand header");
    assert(captionRu.includes("💡 Практическая польза:"), "7.2: Russian caption has Russian takeaway prefix");

    const markupUz = buildNewsPostMarkup(testNews, "uz");
    const btns = markupUz.inline_keyboard[0];
    assert(btns.length === 2, "7.3: Inline keyboard has exactly 2 buttons");
    assert(btns[0].text.includes("Asl manbani o‘qish"), "7.3: First button links to original source");
    assert(btns[0].url === "https://www.gazeta.uz/uz/2026/10/real-estate-prices", "7.3: First button URL is original source");
    assert(btns[1].text === "🏠 ANGREN ESTATE", "7.3: Second button is ANGREN ESTATE brand link");
    assert(btns[1].url.startsWith("https://angrenestate.uz"), "7.3: Second button points to official site domain");
  }

  // -------------------------------------------------------------
  // TEST 8: Mocked Telegram Publishing & Deduplication
  // -------------------------------------------------------------
  console.log("\n--- 8. Mocked Telegram Publishing & Deduplication ---");
  {
    let publishPayload: any = null;
    const originalFetch = global.fetch;

    global.fetch = async (url: any, init?: any): Promise<Response> => {
      const urlStr = String(url);
      if (urlStr.includes("api.telegram.org")) {
        publishPayload = JSON.parse(init?.body || "{}");
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              message_id: 991122,
              chat: { id: -1001234567, title: "ANGREN ESTATE" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, init);
    };

    const savedNews = await saveNewsItem({
      original_title: "Mock Telegram Publish News Test",
      original_url: "https://test.lex.uz/docs/mock-news-101",
      url_hash: computeUrlHash("https://test.lex.uz/docs/mock-news-101"),
      category: "legislation_cadastre",
      published_at: new Date().toISOString(),
      discovered_at: new Date().toISOString(),
      status: "ready",
      requires_fact_check: false,
    });

    const pubResult = await publishNewsToTelegramChannel(savedNews.id, "uz", {
      botToken: "MOCK_TOKEN_NEWS_123",
      channelId: "@angren_estate",
    });

    assert(pubResult.success === true, "8.1: Channel publish returns success=true");
    assert(pubResult.status === "published", "8.1: Status is published");
    assert(pubResult.messageId === 991122, "8.1: messageId matches Telegram response");
    assert(Boolean(publishPayload), "8.1: Telegram API payload was captured");
    assert(publishPayload.text.includes("ANGREN ESTATE | Yangiliklar"), "8.1: Sent payload contains brand title");

    // Deduplication check: Attempting to publish again without forceRepeat returns already_published
    const rePubResult = await publishNewsToTelegramChannel(savedNews.id, "uz", {
      botToken: "MOCK_TOKEN_NEWS_123",
      channelId: "@angren_estate",
    });

    assert(rePubResult.success === true, "8.2: Deduplication returns success=true without resending");
    assert(rePubResult.status === "already_published", "8.2: Status is 'already_published'");
    assert(rePubResult.messageId === 991122, "8.2: Preserves original post message ID");

    global.fetch = originalFetch;
  }

  console.log("\n=======================================================");
  console.log(`SOCIAL CENTER TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSocialCenterTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
