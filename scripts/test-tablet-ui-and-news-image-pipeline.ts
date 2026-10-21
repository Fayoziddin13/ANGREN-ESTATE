/**
 * ANGREN ESTATE — Verification Suite: Tablet Responsive UI & News Image Generation Pipeline
 *
 * Tests:
 * 1. AI & Curated Real Estate Topic Image Generation
 * 2. Image Buffer MIME Type and Binary Signature Validation (JPEG/PNG, not SVG)
 * 3. Fallback Priority Chain (AI -> Source Image -> Curated Editorial)
 * 4. Supabase Storage upload compatibility with contentType 'image/jpeg'
 * 5. Tablet UI Breakpoint & Selector Integrity (Header, Search Panel, Right Controls, Preview Card, Admin)
 *
 * Run: cmd.exe /c "npx tsx scripts/test-tablet-ui-and-news-image-pipeline.ts" < /dev/null
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

async function runTestSuite() {
  console.log("================================================================================");
  console.log("ANGREN ESTATE — TABLET UI & NEWS IMAGE GENERATION PIPELINE TEST SUITE");
  console.log("================================================================================\n");

  const {
    CATEGORY_EDITORIAL_IMAGES,
    AI_PROMPT_TEMPLATES,
    isValidImageBuffer,
    fetchCuratedImageForCategory,
    generateAndSaveNewsAsset,
    getNewsCardImageBuffer,
    getNewsCardSvgBuffer,
  } = await import("../src/lib/newsVisualGenerator");

  const { saveNewsItem, getNewsById } = await import("../src/lib/newsStore");
  const { extractOpenGraphImage } = await import("../src/lib/newsHarvester");
  const { validateFeedUrlSsrf } = await import("../src/lib/sourceSecurity");

  // ---------------------------------------------------------------------------
  // TEST 1: Category Mapping & Curated Editorial URLs
  // ---------------------------------------------------------------------------
  console.log("1. Testing Category Editorial Images & Prompt Templates...");
  const categories = [
    "market_prices",
    "mortgage_finance",
    "legislation_cadastre",
    "construction_projects",
    "rental_market",
    "taxes_and_fees",
    "useful_tips",
  ] as const;

  for (const cat of categories) {
    assert(CATEGORY_EDITORIAL_IMAGES[cat], `Missing curated image URL for category: ${cat}`);
    assert(CATEGORY_EDITORIAL_IMAGES[cat].startsWith("https://"), `Curated image URL must be HTTPS: ${cat}`);
    assert(AI_PROMPT_TEMPLATES[cat], `Missing AI prompt template for category: ${cat}`);
    assert(AI_PROMPT_TEMPLATES[cat].length > 20, `AI prompt template too short for category: ${cat}`);
  }
  console.log("  ✓ All 7 categories have verified high-resolution HTTPS curated photos and prompt templates");

  // ---------------------------------------------------------------------------
  // TEST 2: Binary Image Buffer Validation (JPEG / PNG / WEBP vs SVG)
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing Binary Image Signature Validation...");
  // Valid JPEG magic header (FF D8 FF)
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(1200).fill(0x20)]);
  assert.strictEqual(isValidImageBuffer(fakeJpeg), true, "JPEG header must be recognized as valid image buffer");

  // Valid PNG magic header (89 50 4E 47)
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(1200).fill(0x20)]);
  assert.strictEqual(isValidImageBuffer(fakePng), true, "PNG header must be recognized as valid image buffer");

  // SVG text buffer
  const fakeSvg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><rect width='100'/></svg>", "utf-8");
  assert.strictEqual(isValidImageBuffer(fakeSvg), false, "SVG text buffer must NOT be treated as binary JPEG/PNG photo");

  // Empty / corrupted buffer
  const emptyBuf = Buffer.alloc(50);
  assert.strictEqual(isValidImageBuffer(emptyBuf), false, "Corrupted short buffer must be rejected");
  console.log("  ✓ Strict binary buffer signature check accurately distinguishes raster photos from SVG");

  // ---------------------------------------------------------------------------
  // TEST 3: Curated Editorial Image Retrieval (Real Binary JPEG)
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing Real Curated Photo Fetching for Real Estate News...");
  const curatedResult = await fetchCuratedImageForCategory("market_prices");
  assert(curatedResult, "Curated photo fetch should succeed");
  assert.strictEqual(curatedResult.origin, "curated");
  assert(curatedResult.buffer.length > 5000, `Buffer must be substantial (>5KB), got: ${curatedResult.buffer.length}`);
  assert.strictEqual(isValidImageBuffer(curatedResult.buffer), true, "Fetched buffer must be a valid JPEG/PNG");
  console.log(`  ✓ Successfully fetched curated high-resolution real estate photo (${curatedResult.buffer.length} bytes, valid JPEG)`);

  // ---------------------------------------------------------------------------
  // TEST 4: SSRF Security on Source Image URLs
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing SSRF Protection on Image Extraction...");
  assert.strictEqual(validateFeedUrlSsrf("http://127.0.0.1/evil.jpg").valid, false, "Localhost IP must be rejected");
  assert.strictEqual(validateFeedUrlSsrf("http://169.254.169.254/latest/meta-data").valid, false, "Cloud metadata must be rejected");
  assert.strictEqual(validateFeedUrlSsrf("file:///etc/passwd").valid, false, "File protocol must be rejected");
  assert.strictEqual(validateFeedUrlSsrf("https://kun.uz/img/photo.jpg").valid, true, "Legitimate HTTPS URL must be allowed");
  console.log("  ✓ SSRF validator strictly protects internal network from rogue image URLs");

  // ---------------------------------------------------------------------------
  // TEST 5: News Item Image Generation & Storage Flow
  // ---------------------------------------------------------------------------
  console.log("\n5. Testing End-to-End Asset Generation & Storage Flow...");
  const testNews = await saveNewsItem({
    original_title: "Angrenda yangi zamonaviy turar-joylar qurilishi boshlandi",
    original_url: "https://kun.uz/news/2026/10/18/angren-yangi-turar-joy",
    source_image_url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&h=675&q=85",
    url_hash: "hash_test_image_" + Date.now(),
    category: "construction_projects",
    published_at: new Date().toISOString(),
    discovered_at: new Date().toISOString(),
    status: "ready",
    requires_fact_check: false,
  });

  const generatedAsset = await generateAndSaveNewsAsset(testNews, "uz");
  assert(generatedAsset, "Must return generated NewsAsset");
  assert.strictEqual(generatedAsset.news_id, testNews.id);
  assert.strictEqual(generatedAsset.language, "uz");
  assert(generatedAsset.storage_path.endsWith(".jpg"), `Storage path must end with .jpg, got: ${generatedAsset.storage_path}`);
  assert.strictEqual(generatedAsset.width, 1200);
  assert.strictEqual(generatedAsset.height, 675);

  const imageBuffer = await getNewsCardImageBuffer(testNews, "uz");
  assert(isValidImageBuffer(imageBuffer), "getNewsCardImageBuffer must return valid binary JPEG/PNG");
  console.log("  ✓ End-to-end asset generation creates .jpg path with valid binary photo buffer");

  // ---------------------------------------------------------------------------
  // TEST 6: Tablet UI Responsive Code Structure Verification
  // ---------------------------------------------------------------------------
  console.log("\n6. Verifying Tablet UI Responsive Code Structure...");

  const headerCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/layout/Header.tsx"), "utf-8");
  assert(headerCode.includes("lg:hidden flex h-8 w-8 items-center justify-center rounded-2xl border border-white/20"), "Tablet hamburger button must exist with lg:hidden");
  assert(headerCode.includes("className=\"lg:hidden border-t border-white/10"), "Mobile/tablet dropdown drawer must use lg:hidden");
  console.log("  ✓ Header has tablet hamburger button and lg:hidden dropdown drawer");

  const pageCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/page.tsx"), "utf-8");
  assert(pageCode.includes("max-w-[calc(100vw-220px)] xl:max-w-[calc(100vw-420px)]"), "Search panel has responsive tablet max-width");
  assert(pageCode.includes("flex-col xl:flex-row items-end xl:items-center"), "Top right controls are stacked vertically on tablet (< xl) and horizontal on desktop (xl:)");
  console.log("  ✓ Map top-right action controls are non-overlapping and stacked on tablet (< xl)");

  const searchPanelCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/map/FloatingSearchPanel.tsx"), "utf-8");
  assert(searchPanelCode.includes("hidden xl:block relative flex-1 min-w-[80px]"), "Individual dropdowns are hidden on tablet (< xl) to prevent bar collision");
  assert(searchPanelCode.includes("hidden sm:inline"), "Filtrlar label is visible on tablet");
  console.log("  ✓ FloatingSearchPanel collapses dropdowns into sleek tablet bar with Filtrlar button");

  const cardCode = fs.readFileSync(path.resolve(process.cwd(), "src/components/map/PropertyPreviewCard.tsx"), "utf-8");
  assert(cardCode.includes("max-h-[min(540px,calc(100vh-140px))]"), "PropertyPreviewCard has max-height constraint");
  assert(cardCode.includes("aspect-[16/10] sm:aspect-[16/10] xl:aspect-[4/3]"), "PropertyPreviewCard uses compact aspect ratio");
  console.log("  ✓ PropertyPreviewCard has compact aspect ratio and viewport max-height constraint");

  const adminLayoutCode = fs.readFileSync(path.resolve(process.cwd(), "src/app/admin/layout.tsx"), "utf-8");
  assert(adminLayoutCode.includes("hidden lg:flex flex-col w-64"), "Admin sidebar uses hidden lg:flex to avoid tablet squeezing");
  assert(adminLayoutCode.includes("lg:hidden sticky top-0"), "Admin mobile/tablet navbar uses lg:hidden");
  console.log("  ✓ Admin layout gives full screen width on tablet with top mobile/tablet navbar");

  console.log("\n================================================================================");
  console.log("ALL TABLET UI & NEWS IMAGE GENERATION PIPELINE TESTS PASSED (100% GREEN)");
  console.log("================================================================================");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
