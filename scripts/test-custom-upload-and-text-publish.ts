/**
 * ANGREN ESTATE — Automated Test Suite for Custom Upload, Text-Only Publish, and Factual Rigor
 */

import assert from "assert";
import { isValidImageBuffer } from "../src/lib/newsVisualGenerator";
import { buildNewsPostCaption, buildNewsPostMarkup } from "../src/lib/newsTelegramPublisher";
import { saveNewsItem, saveNewsAsset, getNewsById, computeUrlHash } from "../src/lib/newsStore";
import { isRealEstateRelated, classifyNewsCategory, extractVerifiedStat } from "../src/lib/newsHarvester";
import type { RealEstateNews } from "../src/lib/types/news";

async function runTestSuite() {
  console.log("================================================================================");
  console.log("ANGREN ESTATE — CUSTOM UPLOAD, TEXT-ONLY & FACTUAL INTEGRITY TEST SUITE");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Custom Image Upload Binary Signature Validation (JPEG/PNG/WEBP vs SVG)
  // ---------------------------------------------------------------------------
  console.log("1. Testing Custom Image Binary Signature Validation...");
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(0x00)]);
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(200).fill(0x00)]);
  const validWebp = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...Array(200).fill(0x00)
  ]);
  const fakeSvg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><text>fake</text></svg>");
  const fakeHtml = Buffer.from("<!DOCTYPE html><html><body><h1>Hacked</h1></body></html>");

  assert.strictEqual(isValidImageBuffer(validJpeg), true, "Valid JPEG must pass signature check");
  assert.strictEqual(isValidImageBuffer(validPng), true, "Valid PNG must pass signature check");
  assert.strictEqual(isValidImageBuffer(validWebp), true, "Valid WEBP must pass signature check");
  assert.strictEqual(isValidImageBuffer(fakeSvg), false, "SVG text buffer must be strictly rejected");
  assert.strictEqual(isValidImageBuffer(fakeHtml), false, "HTML text buffer must be strictly rejected");
  console.log("  ✓ Binary validator correctly accepts JPEG, PNG, WEBP and strictly rejects SVG/HTML");

  // ---------------------------------------------------------------------------
  // TEST 2: Factual Elements in Telegram Caption (Title, Date, Source, Link)
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing Required Factual Metadata in Telegram Post Caption...");
  const sampleNews = await saveNewsItem({
    original_title: "Ipoteka krediti bo‘yicha yangi davlat subsidiyalari ajratiladi",
    original_url: "https://cbu.uz/uz/press_center/news/123456/",
    url_hash: "hash_test_cbu_" + Date.now(),
    category: "mortgage_finance",
    published_at: "2026-10-22T08:30:00.000Z",
    discovered_at: new Date().toISOString(),
    status: "needs_review",
    requires_fact_check: true,
  });

  const caption = buildNewsPostCaption(sampleNews, "uz");
  assert(caption.includes("📌 Ipoteka krediti bo‘yicha"), "Caption must include title");
  assert(caption.includes("📅 Sana:"), "Caption must include date label");
  assert(/22[./]10[./]2026/.test(caption), "Caption must include formatted date (22.10.2026 or 22/10/2026)");
  assert(caption.includes("📰 Manba: cbu.uz"), "Caption must include source name");
  assert(caption.includes("🔗 Asl maqola: https://cbu.uz/uz/press_center/news/123456/"), "Caption must include verifiable original URL");
  assert(caption.includes("@angren_estate"), "Caption must include channel handle");
  console.log("  ✓ Telegram post caption contains all required factual metadata (Title, Date, Source, Original Link)");

  // ---------------------------------------------------------------------------
  // TEST 3: Compliant Inline Markup with Verifiable Direct Link
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing Inline Keyboard Markup Verifiable Source URL...");
  const markup = buildNewsPostMarkup(sampleNews, "uz");
  assert.strictEqual(markup.inline_keyboard.length, 1);
  assert.strictEqual(markup.inline_keyboard[0][0].text, "📖 Asl manbani o‘qish →");
  assert.strictEqual(markup.inline_keyboard[0][0].url, "https://cbu.uz/uz/press_center/news/123456/");
  console.log("  ✓ Inline button directs to verified original article source URL");

  // ---------------------------------------------------------------------------
  // TEST 4: Custom Image Asset Attachment and Provenance
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing Custom Uploaded Asset Registration and Metadata...");
  const customAsset = await saveNewsAsset({
    news_id: sampleNews.id,
    language: "uz",
    storage_path: `news/${sampleNews.id}/custom_${Date.now()}.jpg`,
    public_url: `https://gemozzkmoogjxtdwvepz.supabase.co/storage/v1/object/public/property-images/news/${sampleNews.id}/custom.jpg`,
    asset_type: "custom_upload",
    source_origin: "custom_upload",
    width: 1200,
    height: 675,
  });

  const updatedNews = await getNewsById(sampleNews.id);
  assert(updatedNews?.assets?.uz, "Asset must be registered on news item");
  assert.strictEqual(updatedNews?.assets?.uz?.asset_type, "custom_upload");
  assert.strictEqual(updatedNews?.assets?.uz?.source_origin, "custom_upload");
  console.log("  ✓ Custom image uploaded from computer registered with asset_type='custom_upload'");

  // ---------------------------------------------------------------------------
  // TEST 5: Real Estate Relevance & Factual Classification
  // ---------------------------------------------------------------------------
  console.log("\n5. Testing Domain Relevance & Classification Integrity...");
  assert.strictEqual(isRealEstateRelated("Angren shahrida yangi turar-joy majmuasi foydalanishga topshirildi", "Bino va kvartiralar"), true);
  assert.strictEqual(isRealEstateRelated("Futbol bo‘yicha O‘zbekiston chempionati", "Bugungi o‘yinlar natijasi"), false);
  assert.strictEqual(classifyNewsCategory("Yangi qonun qabul qilindi", "Mulk huquqi va kadastr tizimi"), "legislation_cadastre");
  assert.strictEqual(classifyNewsCategory("Ipoteka stavkalari o‘zgardi", "Markaziy bank stavkasi"), "mortgage_finance");
  console.log("  ✓ Relevance filter and category classifier operate accurately without false positives");

  // ---------------------------------------------------------------------------
  // TEST 6: Real Stat Extraction without Hallucination
  // ---------------------------------------------------------------------------
  console.log("\n6. Testing Stat Extraction (Zero Hallucination)...");
  const extracted = extractVerifiedStat("Ipoteka krediti bo‘yicha boshlang‘ich to‘lov 17.5% etib belgilandi");
  assert.strictEqual(extracted, "17.5%", "Must extract exact stat from text");
  const noStat = extractVerifiedStat("Bugun yangi qaror e'lon qilindi");
  assert.strictEqual(noStat, undefined, "Must return undefined when text has no statistics (no invention)");
  console.log("  ✓ Statistical values extracted purely from source text without hallucinating numbers");

  // ---------------------------------------------------------------------------
  // TEST 7: Canonical URL Hash Deduplication
  // ---------------------------------------------------------------------------
  console.log("\n7. Testing URL Hash Deduplication Determinism...");
  const hash1 = computeUrlHash("https://lex.uz/docs/12345");
  const hash2 = computeUrlHash("https://lex.uz/docs/12345");
  const hash3 = computeUrlHash("https://lex.uz/docs/67890");
  assert.strictEqual(hash1, hash2, "Identical URLs must yield identical hash");
  assert.notStrictEqual(hash1, hash3, "Different URLs must yield distinct hashes");
  console.log("  ✓ Deduplication hash is completely deterministic");

  console.log("\n================================================================================");
  console.log("ALL CUSTOM UPLOAD, TEXT-ONLY & FACTUAL INTEGRITY TESTS PASSED (100% GREEN)");
  console.log("================================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
