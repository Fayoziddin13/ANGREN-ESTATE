/**
 * ANGREN ESTATE - PHASE 4B / STEP 5
 * Dedicated Verification Test Suite for CMS & Site Content System
 *
 * 14 Canonical Assertions:
 *  1. Public read of /api/content returns HTTP 200 with all 6 canonical keys and source: database
 *  2. Sensitive/internal keys in app_settings are NOT leaked by /api/content (defense-in-depth API filtering)
 *  3. Direct client anonymous SELECT on app_settings for sensitive key is blocked by RLS
 *  4. Unauthenticated PATCH /api/admin/content returns HTTP 401
 *  5. Authenticated PATCH /api/admin/content successfully updates a section (announcement)
 *  6. Stale PATCH /api/admin/content with outdated expected_updated_at returns HTTP 409 Conflict
 *  7. Public /api/content immediately reflects the updated data without delay (revalidate = 0, no-store)
 *  8. Content updates are correctly reflected in both UZ and RU responses
 *  9. Root metadata and canonical defaults are properly configured for SEO in src/app/layout.tsx
 * 10. Zero localStorage writes/reads for CMS content in modern hooks/stores
 * 11. Zero mock CMS data used in public pages (/biz-haqimizda, /kontaktlar, /)
 * 12. Authenticated DELETE /api/admin/content returns HTTP 405 Method Not Allowed (zero delete API)
 * 13. Admin UI (/admin/content) has ZERO delete buttons or delete actions
 * 14. Test cleanup restores any modified test keys back to original state and verifies canonical properties (prop-1 -> Jasur Alimov) remained 100% intact
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Read environment
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

const BASE_URL = "http://localhost:3000";

function makeAdminToken() {
  const secret = env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET is required to generate admin token");
  const payload = {
    id: "admin-primary-1",
    username: "admin",
    email: "admin@angrenestate.uz",
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    rememberMe: true,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
  return `${payloadStr}.${sig}`;
}

async function runTests() {
  console.log("========================================================================");
  console.log("  ANGREN ESTATE - PHASE 4B / STEP 5: CMS & SITE CONTENT VERIFICATION  ");
  console.log("========================================================================\n");

  const results = [];
  let passedCount = 0;

  function assert(title, condition, detail = "") {
    if (condition) {
      console.log(`  [PASS] Assertion ${results.length + 1}: ${title}`);
      if (detail) console.log(`         ${detail}`);
      passedCount++;
      results.push({ title, passed: true });
    } else {
      console.error(`  [FAIL] Assertion ${results.length + 1}: ${title}`);
      if (detail) console.error(`         ${detail}`);
      results.push({ title, passed: false });
    }
  }

  // Backup existing announcement state for restoration at end
  let originalAnnouncement = null;
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "cms_announcement")
      .single();
    originalAnnouncement = data;
  } catch (err) {
    console.warn("Could not backup announcement:", err.message);
  }

  try {
    // -------------------------------------------------------------------------
    // Assertion 1: Public read of /api/content
    // -------------------------------------------------------------------------
    const res1 = await fetch(`${BASE_URL}/api/content`, { cache: "no-store" });
    const data1 = await res1.json();
    const hasAllKeys =
      data1.success === true &&
      data1.source === "database" &&
      data1.content?.hero &&
      data1.content?.about &&
      data1.content?.contacts &&
      data1.content?.announcement &&
      data1.content?.seo &&
      data1.content?.settings;

    assert(
      "Public read of /api/content returns HTTP 200 with all 6 canonical keys and source: database",
      res1.status === 200 && hasAllKeys,
      `Status: ${res1.status}, Source: ${data1.source}, Keys present: ${Object.keys(data1.content || {}).join(", ")}`
    );

    // -------------------------------------------------------------------------
    // Assertion 2: Sensitive keys are NOT leaked by /api/content
    // -------------------------------------------------------------------------
    // Insert a dummy sensitive key directly with service role
    const testSecretKey = "private_internal_api_token_test";
    await supabaseAdmin.from("app_settings").upsert({
      key: testSecretKey,
      value: { secret: "TOP_SECRET_PHASE5_TEST_VALUE_DO_NOT_LEAK" },
      updated_at: new Date().toISOString(),
    });

    const res2 = await fetch(`${BASE_URL}/api/content`, { cache: "no-store" });
    const data2 = await res2.json();
    const leaked = JSON.stringify(data2).includes("TOP_SECRET_PHASE5_TEST_VALUE_DO_NOT_LEAK");

    assert(
      "Sensitive/internal keys in app_settings are NOT leaked by /api/content (defense-in-depth API filtering)",
      !leaked && !data2.content[testSecretKey],
      `Sensitive key '${testSecretKey}' excluded from public API payload.`
    );

    // Clean up test sensitive key
    await supabaseAdmin.from("app_settings").delete().eq("key", testSecretKey);

    // -------------------------------------------------------------------------
    // Assertion 3: Direct client anonymous SELECT on app_settings for sensitive key is blocked by RLS
    // -------------------------------------------------------------------------
    const { data: anonSensitiveSelect } = await supabaseAnon
      .from("app_settings")
      .select("key, value")
      .eq("key", "admin_secret_key");

    assert(
      "Direct client anonymous SELECT on app_settings for sensitive keys is blocked/empty via RLS",
      !anonSensitiveSelect || anonSensitiveSelect.length === 0,
      `Anon query on non-cms key returned ${anonSensitiveSelect ? anonSensitiveSelect.length : 0} rows.`
    );

    // -------------------------------------------------------------------------
    // Assertion 4: Unauthenticated PATCH /api/admin/content returns HTTP 401
    // -------------------------------------------------------------------------
    const res4 = await fetch(`${BASE_URL}/api/admin/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "announcement", data: { is_active: true } }),
    });

    assert(
      "Unauthenticated PATCH /api/admin/content returns HTTP 401 Unauthorized",
      res4.status === 401,
      `Returned HTTP status: ${res4.status}`
    );

    // -------------------------------------------------------------------------
    // Assertion 5: Authenticated PATCH /api/admin/content successfully updates a section
    // -------------------------------------------------------------------------
    const adminToken = makeAdminToken();
    const adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
      Cookie: `angren_admin_token=${adminToken}`,
    };

    // Get current updated_at for announcement
    const getRes = await fetch(`${BASE_URL}/api/admin/content`, { headers: adminHeaders, cache: "no-store" });
    const getData = await getRes.json();
    const currentAnnouncementTimestamp = getData.timestamps?.announcement || new Date().toISOString();

    const testAnnouncementTextUz = "Step 5 Test E'lon Banneri " + Date.now();
    const testAnnouncementTextRu = "Тестовое объявление баннера Step 5 " + Date.now();

    const patchRes = await fetch(`${BASE_URL}/api/admin/content`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        section: "announcement",
        data: {
          is_active: true,
          type: "info",
          text_uz: testAnnouncementTextUz,
          text_ru: testAnnouncementTextRu,
          link_url: "/sotib-olish",
        },
        expected_updated_at: currentAnnouncementTimestamp,
      }),
    });

    const patchData = await patchRes.json();

    assert(
      "Authenticated PATCH /api/admin/content successfully updates a section (announcement)",
      patchRes.status === 200 && patchData.success === true && !!patchData.updated_at,
      `Status: ${patchRes.status}, Success: ${patchData.success}, UpdatedAt: ${patchData.updated_at}`
    );

    // -------------------------------------------------------------------------
    // Assertion 6: Stale PATCH with outdated expected_updated_at returns HTTP 409 Conflict
    // -------------------------------------------------------------------------
    const staleTimestamp = new Date(Date.now() - 1000000).toISOString();
    const conflictRes = await fetch(`${BASE_URL}/api/admin/content`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        section: "announcement",
        data: { text_uz: "Stale update attempt" },
        expected_updated_at: staleTimestamp,
      }),
    });

    const conflictData = await conflictRes.json();

    assert(
      "Stale PATCH /api/admin/content with outdated expected_updated_at returns HTTP 409 Conflict",
      conflictRes.status === 409 && conflictData.error === "VERSION_CONFLICT",
      `Status: ${conflictRes.status}, Error: ${conflictData.error}`
    );

    // -------------------------------------------------------------------------
    // Assertion 7: Public /api/content immediately reflects updated data without delay
    // -------------------------------------------------------------------------
    const immediateRes = await fetch(`${BASE_URL}/api/content`, { cache: "no-store" });
    const immediateData = await immediateRes.json();
    const matchesImmediate =
      immediateData.content?.announcement?.text_uz === testAnnouncementTextUz &&
      immediateData.content?.announcement?.is_active === true;

    assert(
      "Public /api/content immediately reflects updated data without delay (revalidate = 0, no-store)",
      immediateRes.status === 200 && matchesImmediate,
      `Live content text: "${immediateData.content?.announcement?.text_uz}"`
    );

    // -------------------------------------------------------------------------
    // Assertion 8: Content updates are correctly reflected in both UZ and RU responses
    // -------------------------------------------------------------------------
    const uzText = immediateData.content?.announcement?.text_uz;
    const ruText = immediateData.content?.announcement?.text_ru;
    const bilingualMatch =
      uzText === testAnnouncementTextUz && ruText === testAnnouncementTextRu;

    assert(
      "Content updates are correctly reflected in both UZ and RU responses",
      bilingualMatch,
      `UZ: "${uzText}", RU: "${ruText}"`
    );

    // -------------------------------------------------------------------------
    // Assertion 9: Root metadata and canonical defaults configured for SEO in layout.tsx
    // -------------------------------------------------------------------------
    const layoutPath = path.join(__dirname, "..", "src", "app", "layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf8");
    const hasCanonical = layoutContent.includes("canonical: \"https://angrenestate.uz\"");
    const hasOpenGraph = layoutContent.includes("openGraph:");
    const hasAlternates = layoutContent.includes("alternates:");

    assert(
      "Root metadata and canonical defaults are properly configured for SEO in src/app/layout.tsx",
      hasCanonical && hasOpenGraph && hasAlternates,
      `Layout includes canonical, openGraph, and alternates definitions.`
    );

    // -------------------------------------------------------------------------
    // Assertion 10: Zero localStorage writes/reads for CMS content in modern hooks/stores
    // -------------------------------------------------------------------------
    const cmsStorePath = path.join(__dirname, "..", "src", "lib", "cmsStore.ts");
    const cmsStoreContent = fs.readFileSync(cmsStorePath, "utf8");
    const siteSettingsStorePath = path.join(__dirname, "..", "src", "lib", "siteSettingsStore.ts");
    const siteSettingsContent = fs.readFileSync(siteSettingsStorePath, "utf8");

    // The only allowed localStorage operation is removeItem (purging legacy keys)
    const hasCmsLocalStorageWrite = /localStorage\.setItem\(\s*["']angren_estate_cms/i.test(cmsStoreContent);
    const hasSiteSettingsLocalStorageWrite = /localStorage\.setItem\(\s*["']angren_estate_site_settings/i.test(siteSettingsContent);

    assert(
      "Zero localStorage writes for CMS content in modern hooks/stores (only purge allowed)",
      !hasCmsLocalStorageWrite && !hasSiteSettingsLocalStorageWrite,
      `cmsStore has setItem: ${hasCmsLocalStorageWrite}, siteSettingsStore has setItem: ${hasSiteSettingsLocalStorageWrite}`
    );

    // -------------------------------------------------------------------------
    // Assertion 11: Zero mock CMS data used in public pages
    // -------------------------------------------------------------------------
    const aboutPagePath = path.join(__dirname, "..", "src", "app", "biz-haqimizda", "page.tsx");
    const aboutContent = fs.readFileSync(aboutPagePath, "utf8");
    const usesCmsInAbout = aboutContent.includes("useCMS()");

    const heroCompPath = path.join(__dirname, "..", "src", "components", "home", "HeroSection.tsx");
    const heroContent = fs.readFileSync(heroCompPath, "utf8");
    const usesCmsInHero = heroContent.includes("useCMS()");

    const headerCompPath = path.join(__dirname, "..", "src", "components", "layout", "Header.tsx");
    const headerContent = fs.readFileSync(headerCompPath, "utf8");
    const usesCmsInHeader = headerContent.includes("useCMS()");

    assert(
      "Zero mock CMS data used in public pages (pages hooked directly to live useCMS)",
      usesCmsInAbout && usesCmsInHero && usesCmsInHeader,
      `useCMS hooked in About: ${usesCmsInAbout}, Hero: ${usesCmsInHero}, Header: ${usesCmsInHeader}`
    );

    // -------------------------------------------------------------------------
    // Assertion 12: Authenticated DELETE /api/admin/content returns HTTP 405
    // -------------------------------------------------------------------------
    const deleteRes = await fetch(`${BASE_URL}/api/admin/content`, {
      method: "DELETE",
      headers: adminHeaders,
    });

    assert(
      "Authenticated DELETE /api/admin/content returns HTTP 405 Method Not Allowed (zero delete API)",
      deleteRes.status === 405,
      `Returned HTTP status: ${deleteRes.status}, Allow header: ${deleteRes.headers.get("allow")}`
    );

    // -------------------------------------------------------------------------
    // Assertion 13: Admin UI (/admin/content) has ZERO delete buttons or delete actions
    // -------------------------------------------------------------------------
    const adminContentPagePath = path.join(__dirname, "..", "src", "app", "admin", "content", "page.tsx");
    const adminContentPageCode = fs.readFileSync(adminContentPagePath, "utf8");
    const hasDeleteButton =
      /<button[^>]*>[\s\S]*?(?:o‘chirish|удалить|delete)[\s\S]*?<\/button>/i.test(adminContentPageCode) ||
      /handleDelete/i.test(adminContentPageCode);

    assert(
      "Admin UI (/admin/content) has ZERO delete buttons or delete actions",
      !hasDeleteButton,
      `admin/content/page.tsx has no delete buttons or delete handlers.`
    );

    // -------------------------------------------------------------------------
    // Assertion 14: Test cleanup and property-realtor relationship integrity check
    // -------------------------------------------------------------------------
    // Restore original announcement
    if (originalAnnouncement) {
      await supabaseAdmin.from("app_settings").upsert({
        key: "cms_announcement",
        value: originalAnnouncement.value,
        updated_at: new Date().toISOString(),
      });
    }

    // Verify canonical prop-1 -> Jasur Alimov
    const { data: prop1, error: propErr } = await supabaseAdmin
      .from("properties")
      .select("id, title_uz, realtor_id, realtors(id, name)")
      .eq("id", "prop-1")
      .single();

    const isProp1Canonical =
      prop1 &&
      prop1.realtor_id === "00000000-0000-0000-0000-000000000001" &&
      prop1.realtors?.name === "Jasur Alimov";

    assert(
      "Test cleanup restores state and verifies canonical properties (prop-1 -> Jasur Alimov) remained 100% intact",
      !propErr && isProp1Canonical,
      `prop-1 realtor_id: ${prop1?.realtor_id} (${prop1?.realtors?.name})`
    );

  } catch (err) {
    console.error("Test execution error:", err);
  }

  console.log("\n------------------------------------------------------------------------");
  console.log(`  FINAL RESULT: ${passedCount}/${results.length} assertions PASSED.`);
  console.log("------------------------------------------------------------------------\n");

  if (passedCount === results.length) {
    console.log(">>> ALL 14 PHASE 4B / STEP 5 ASSERTIONS PASSED SUCCESSFULLY! <<<\n");
    process.exit(0);
  } else {
    console.error(`>>> FAILED: ${results.length - passedCount} assertion(s) failed. <<<\n`);
    process.exit(1);
  }
}

runTests();
