/**
 * Test Suite: News Sources Discovery, SSRF Protection, Deduplication & Health Monitoring
 * Run: npx tsx scripts/test-news-sources-management.ts
 */

import { validateFeedUrlSsrf, isPrivateOrReservedIpv4 } from "../src/lib/sourceSecurity";
import {
  DEFAULT_SOURCES,
  getNewsSources,
  saveNewsSource,
  deleteNewsSource,
  toggleNewsSourceActive,
  seedDefaultSourcesIfMissing,
  recordSourceCheck,
} from "../src/lib/newsStore";
import { parseRssXml } from "../src/lib/newsHarvester";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("ANGREN ESTATE — NEWS SOURCES & SSRF SECURITY VERIFICATION TEST SUITE");
  console.log("================================================================================\n");

  // 1. SSRF Security Validation Tests
  console.log("--- 1. Testing SSRF Defenses ---");
  const ssrfDangerousUrls = [
    "http://localhost:3000/rss",
    "http://127.0.0.1:8080/feed",
    "http://127.0.0.1/rss",
    "http://0.0.0.0/rss",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/feed.xml",
    "http://192.168.1.1/feed.rss",
    "http://172.16.0.1/rss",
    "http://172.31.255.255/feed",
    "file:///etc/passwd",
    "ftp://example.com/rss",
    "gopher://example.com/1",
    "javascript:alert(1)",
    "https://admin:secret@example.com/rss",
    "http://user@127.0.0.1/feed",
    "http://example.com:22/rss",
    "http://example.com:6379/rss",
    "http://example.com:5432/feed",
    "http://2130706433/rss",
    "http://0x7f000001/feed",
    "http://127.000.000.001/rss",
    "http://[::ffff:127.0.0.1]/rss",
    "http://[::1]/feed",
    "http://[fe80::1]/rss",
    "http://internal-host/feed",
  ];

  for (const dangerousUrl of ssrfDangerousUrls) {
    const res = validateFeedUrlSsrf(dangerousUrl);
    assert(!res.valid, `Blocked dangerous SSRF URL: ${dangerousUrl} (reason: ${res.error})`);
  }

  // Safe external URLs should pass
  const ssrfSafeUrls = [
    "https://lex.uz/rss",
    "https://lex.uz/ru/rss",
    "https://cbu.uz/uz/press_center/news/rss/",
    "https://uza.uz/uz/rss",
    "https://www.gazeta.uz/uz/rss/",
    "https://www.spot.uz/rss/",
    "https://kun.uz/news/rss",
    "https://daryo.uz/rss",
    "https://podrobno.uz/rss",
  ];

  for (const safeUrl of ssrfSafeUrls) {
    const res = validateFeedUrlSsrf(safeUrl);
    assert(res.valid, `Allowed safe public feed: ${safeUrl}`);
    assert(Boolean(res.domain), `Extracted domain "${res.domain}" from ${safeUrl}`);
  }

  // 2. Verified Default Sources Integrity
  console.log("\n--- 2. Testing Default Verified Sources ---");
  assert(DEFAULT_SOURCES.length === 11, `All 11 verified sources are configured (found: ${DEFAULT_SOURCES.length})`);

  const officialGov = DEFAULT_SOURCES.filter((s) => s.trust_level === "official_gov");
  const reputableMedia = DEFAULT_SOURCES.filter((s) => s.trust_level === "reputable_media");
  assert(officialGov.length === 5, `5 official government sources found (Lex.uz UZ/RU, CBU, UzA UZ/RU)`);
  assert(reputableMedia.length === 6, `6 reputable media sources found (Gazeta UZ/RU, Spot, Kun, Daryo, Podrobno)`);

  for (const src of DEFAULT_SOURCES) {
    const check = validateFeedUrlSsrf(src.feed_url);
    assert(check.valid, `Default source "${src.name}" passes SSRF check`);
    assert(src.is_active === true, `Default source "${src.name}" is active by default`);
  }

  // 3. RSS Parsing & Link Normalization Tests
  console.log("\n--- 3. Testing RSS Parser & Link Normalization ---");
  const sampleLexXml = `<?xml version="1.0" encoding="utf-8"?>
  <rss version="2.0">
    <channel>
      <title>Lex.uz</title>
      <item>
        <title>O‘zbekiston Respublikasi Vazirlar Mahkamasining qarori</title>
        <link>/ru/docs/8540172</link>
        <guid>/ru/docs/8540172</guid>
        <description>Ko‘chmas mulk kadastri to‘g‘risida yangi nizom tasdiqlandi.</description>
        <pubDate>Thu, 16 Oct 2026 12:00:00 +0500</pubDate>
      </item>
    </channel>
  </rss>`;

  const parsedItems = parseRssXml(sampleLexXml);
  assert(parsedItems.length === 1, "Parsed exactly 1 item from RSS sample");
  assert(parsedItems[0].title.includes("Vazirlar Mahkamasi"), "Correctly extracted title");
  assert(parsedItems[0].link === "/ru/docs/8540172", "Extracted relative link from sample");

  // 4. Source Management, Seeding & Deduplication Tests
  console.log("\n--- 4. Testing News Store Seeding & Deduplication ---");
  const seedResult = await seedDefaultSourcesIfMissing();
  assert(seedResult.total >= 11, `Store has at least 11 sources after seeding (total: ${seedResult.total})`);

  // Seeding again must be idempotent (0 newly added)
  const seedResult2 = await seedDefaultSourcesIfMissing();
  assert(seedResult2.added === 0, `Idempotent: 0 newly added on second seed run`);

  // Test adding a test source
  const testSourceFeed = "https://example.com/test-estate-news/rss.xml";
  const savedTest = await saveNewsSource({
    name: "Test Estate Bulletin",
    domain: "example.com",
    feed_url: testSourceFeed,
    source_type: "rss",
    trust_level: "analytical_center",
    check_frequency_min: 120,
    is_active: true,
  });
  assert(savedTest.feed_url === testSourceFeed, "Successfully saved custom source");

  // Record a health check for the test source
  await recordSourceCheck({
    source_id: savedTest.id,
    status: "success",
    items_found: 15,
    new_items_count: 3,
  });

  // Verify health check attached to source
  const sourcesWithHealth = await getNewsSources();
  const foundTest = sourcesWithHealth.find((s) => s.id === savedTest.id);
  assert(Boolean(foundTest), "Found custom test source in getNewsSources()");
  assert(foundTest?.last_check?.status === "success", "Attached last_check status === 'success'");
  assert(foundTest?.last_check?.items_found === 15, "Attached last_check items_found === 15");

  // Toggle active test
  await toggleNewsSourceActive(savedTest.id, false);
  const afterDeactivate = await getNewsSources();
  const deactivated = afterDeactivate.find((s) => s.id === savedTest.id);
  assert(deactivated?.is_active === false, "Source successfully toggled to inactive");

  await toggleNewsSourceActive(savedTest.id, true);
  const afterReactivate = await getNewsSources();
  const reactivated = afterReactivate.find((s) => s.id === savedTest.id);
  assert(reactivated?.is_active === true, "Source successfully toggled back to active");

  // Clean up test source
  const deleted = await deleteNewsSource(savedTest.id);
  assert(deleted === true, "Test source successfully deleted");

  const sourcesAfterDelete = await getNewsSources();
  const stillExists = sourcesAfterDelete.some((s) => s.id === savedTest.id);
  assert(!stillExists, "Confirmed test source no longer exists in store");

  console.log("\n================================================================================");
  console.log("🎉 ALL TESTS PASSED! News sources management & SSRF protection fully verified.");
  console.log("================================================================================");
}

runTestSuite().catch((err) => {
  console.error("Test execution failed with unexpected error:", err);
  process.exit(1);
});
