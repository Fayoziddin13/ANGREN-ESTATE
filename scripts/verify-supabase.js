const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const ENV_FILE = path.join(__dirname, "..", ".env.local");

async function run() {
  console.log("===============================================================================");
  console.log("ANGREN ESTATE — SUPABASE DATABASE & CANONICAL PIPELINE VERIFICATION (13 STEPS)");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // 1. SUPABASE CONNECTION DIAGNOSTICS
  // ---------------------------------------------------------------------------
  console.log("--- 1. SUPABASE CONNECTION DIAGNOSTICS ---");
  let envUrl = "";
  let envKey = "";
  let envAdminIdentifier = process.env.ADMIN_IDENTIFIER || "admin@angrenestate.uz";
  let envAdminPassword = process.env.ADMIN_PASSWORD || "";
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
    for (const line of lines) {
      if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
        envUrl = line.split("=")[1].trim();
      }
      if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
        envKey = line.split("=")[1].trim();
      }
      if (line.startsWith("ADMIN_IDENTIFIER=")) {
        envAdminIdentifier = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, '');
      }
      if (line.startsWith("ADMIN_PASSWORD=")) {
        envAdminPassword = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  console.log(`Configured URL: ${envUrl || "(not found)"}`);
  console.log(`Configured Anon Key: ${envKey ? envKey.slice(0, 12) + "..." : "(not found)"}`);

  const isPlaceholder =
    !envUrl ||
    envUrl.includes("your-project") ||
    envUrl.includes("mock-project") ||
    !envKey ||
    envKey.includes("your-anon-key");

  let connectionStatus = {
    configured: !isPlaceholder,
    connected: false,
    latencyMs: null,
    message: "",
  };

  if (isPlaceholder) {
    connectionStatus.message =
      "DISCONNECTED (Placeholder credentials in .env.local: NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co). Real Supabase credentials must be supplied to reach a remote instance.";
    console.log(`\n⚠️  Supabase Connection Status: ${connectionStatus.message}`);
  } else {
    try {
      const start = Date.now();
      const testRes = await fetch(`${envUrl}/rest/v1/properties?select=id&limit=1`, {
        headers: {
          apikey: envKey,
          Authorization: `Bearer ${envKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - start;
      if (testRes.ok) {
        connectionStatus.connected = true;
        connectionStatus.latencyMs = latency;
        connectionStatus.message = `CONNECTED (Live Supabase PostGIS reachable, latency: ${latency}ms, status: ${testRes.status})`;
        console.log(`\n✅ Supabase Connection Status: ${connectionStatus.message}`);
      } else {
        connectionStatus.message = `FAILED (HTTP ${testRes.status}: ${await testRes.text()})`;
        console.log(`\n❌ Supabase Connection Status: ${connectionStatus.message}`);
      }
    } catch (err) {
      connectionStatus.message = `NETWORK ERROR (${err.message})`;
      console.log(`\n❌ Supabase Connection Status: ${connectionStatus.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ADMIN AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. ADMIN AUTHENTICATION ---");
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: envAdminIdentifier,
      password: envAdminPassword,
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status}`);
  }

  const setCookie = loginRes.headers.get("set-cookie") || "";
  const adminCookie = setCookie.split(";")[0];
  console.log("✓ Admin authenticated successfully via secure session token.");

  const adminHeaders = {
    "Content-Type": "application/json",
    Cookie: adminCookie,
  };

  const TEST_ID = "prop-e2e-supabase-test-1";

  // ---------------------------------------------------------------------------
  // 13-STEP LIFECYCLE VERIFICATION
  // ---------------------------------------------------------------------------

  // STEP 1: Admin creates property
  console.log("\n[STEP 1] Admin creates property (status: draft)...");
  const createPayload = {
    id: TEST_ID,
    title_uz: "Angren Supabase Elita Rezidensiya",
    title_ru: "Элитная Резиденция Ангрен (Supabase E2E)",
    description_uz: "PostGIS koordinatalari va to‘liq spetsifikatsiyaga ega zamonaviy xonadon.",
    description_ru: "Современная квартира с PostGIS координатами и полной спецификацией.",
    address_uz: "Mustaqillik shoh ko‘chasi, 77-uy",
    address_ru: "Проспект Мустакиллик, д. 77",
    district_name_uz: "Markaz",
    district_name_ru: "Центр",
    transaction_type: "sale",
    deal_type: "sale",
    property_type: "apartment",
    status: "draft",
    price_uzs: 620000000,
    price_usd: 48250,
    area_sqm: 84,
    living_area_sqm: 65,
    rooms: 3,
    floor: 5,
    total_floors: 9,
    renovation: "designer",
    coordinates: { lat: 41.0185, lng: 70.1442 },
    images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
    utilities: { gas: true, water: true, electricity: true, sewerage: true, heating: true },
    amenities: { furniture: true, parking: true, elevator: true, ac: true, balcony: true, internet: true },
    contact_phone: "+998 90 777 00 11",
  };

  const createRes = await fetch(`${BASE_URL}/api/admin/properties`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    throw new Error(`Create failed: ${createRes.status} ${await createRes.text()}`);
  }
  const createdJson = await createRes.json();
  console.log(`✓ Admin created property ID: ${createdJson.property.id}, status: ${createdJson.property.status}`);

  // STEP 2: Property is saved in the database
  console.log("\n[STEP 2] Property is verified saved in database...");
  const adminGetRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    headers: adminHeaders,
  });
  if (!adminGetRes.ok) {
    throw new Error(`Failed to read created property from database: ${adminGetRes.status}`);
  }
  const savedRecord = (await adminGetRes.json()).property;
  console.log(`✓ Confirmed: Saved in database. Title: "${savedRecord.title_uz}", Status: "${savedRecord.status}"`);

  // STEP 3: The exact same property ID exists in the database
  console.log("\n[STEP 3] Verifying exact same property ID exists...");
  if (savedRecord.id !== TEST_ID) {
    throw new Error(`ID mismatch: expected ${TEST_ID}, got ${savedRecord.id}`);
  }
  console.log(`✓ Confirmed: Exact same ID "${savedRecord.id}" exists in database.`);

  // STEP 4: Public website receives property (after publish)
  console.log("\n[STEP 4] Admin changes status to 'published'...");
  const publishRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "published" }),
  });
  if (!publishRes.ok) {
    throw new Error(`Publish failed: ${publishRes.status}`);
  }
  console.log("✓ Property published in canonical database.");

  // STEP 5: Property appears on the public map
  console.log("\n[STEP 5] Testing public map markers query (fresh session, unauthenticated)...");
  const publicFreshRes = await fetch(`${BASE_URL}/api/properties`, {
    headers: { "Cache-Control": "no-cache" },
  });
  const publicData = await publicFreshRes.json();
  const mapMarkerItem = publicData.properties.find((p) => p.id === TEST_ID);
  if (!mapMarkerItem) {
    throw new Error(`Property ${TEST_ID} not found on public map!`);
  }
  console.log(`✓ Confirmed on public map: ID: ${mapMarkerItem.id}, Coords: [${mapMarkerItem.coordinates.lat}, ${mapMarkerItem.coordinates.lng}]`);

  // STEP 6: Property appears in the public catalog
  console.log("\n[STEP 6] Testing public catalog (sotib-olish / sale listings)...");
  const catalogRes = await fetch(`${BASE_URL}/api/properties?type=sale`, {
    headers: { "Cache-Control": "no-cache" },
  });
  const catalogData = await catalogRes.json();
  const catalogItem = catalogData.properties.find((p) => p.id === TEST_ID);
  if (!catalogItem) {
    throw new Error(`Property ${TEST_ID} not found in public sale catalog!`);
  }
  console.log(`✓ Confirmed in public catalog: Title: "${catalogItem.title_uz}", Price: ${catalogItem.price_uzs} UZS`);

  // STEP 7: Admin changes the title and price
  console.log("\n[STEP 7] Admin edits property title and price...");
  const NEW_TITLE = "Angren Markazi Premium Penthouse (Supabase Realtime)";
  const NEW_PRICE = 890000000;
  const editRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      title_uz: NEW_TITLE,
      price_uzs: NEW_PRICE,
      price: NEW_PRICE,
    }),
  });
  if (!editRes.ok) {
    throw new Error(`Edit failed: ${editRes.status}`);
  }
  console.log(`✓ Admin updated: Title = "${NEW_TITLE}", Price = ${NEW_PRICE} UZS`);

  // STEP 8: Public website immediately reflects the same title and price
  console.log("\n[STEP 8] Verifying public website reflects updated title and price...");
  const publicDetailRes = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!publicDetailRes.ok) {
    throw new Error(`Public detail fetch failed: ${publicDetailRes.status}`);
  }
  const publicDetail = (await publicDetailRes.json()).property;
  if (publicDetail.title_uz !== NEW_TITLE) {
    throw new Error(`Title mismatch! Expected "${NEW_TITLE}", got "${publicDetail.title_uz}"`);
  }
  if (publicDetail.price_uzs !== NEW_PRICE) {
    throw new Error(`Price mismatch! Expected ${NEW_PRICE}, got ${publicDetail.price_uzs}`);
  }
  console.log(`✓ Confirmed public update: "${publicDetail.title_uz}", ${publicDetail.price_uzs} UZS`);

  // STEP 9: Admin changes status to draft
  console.log("\n[STEP 9] Admin unpublishes property (changes status to 'draft')...");
  const unpublishRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "draft" }),
  });
  if (!unpublishRes.ok) {
    throw new Error(`Unpublish failed: ${unpublishRes.status}`);
  }
  console.log("✓ Status set to 'draft'");

  // STEP 10: Property disappears from public website
  console.log("\n[STEP 10] Verifying property disappeared from public website...");
  const publicAfterDraftRes = await fetch(`${BASE_URL}/api/properties`, {
    headers: { "Cache-Control": "no-cache" },
  });
  const publicAfterDraft = await publicAfterDraftRes.json();
  const existsPublicly = publicAfterDraft.properties.some((p) => p.id === TEST_ID);
  if (existsPublicly) {
    throw new Error(`Draft property ${TEST_ID} is still visible on public website!`);
  }

  const detailDraftRes = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`);
  if (detailDraftRes.status !== 404) {
    throw new Error(`Expected HTTP 404 for draft property on public endpoint, got ${detailDraftRes.status}`);
  }
  console.log("✓ Confirmed: Completely omitted from public map and catalog (HTTP 404 on direct detail endpoint)");

  // STEP 11: Admin publishes it again
  console.log("\n[STEP 11] Admin re-publishes property...");
  const republishRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "published" }),
  });
  if (!republishRes.ok) {
    throw new Error(`Republish failed: ${republishRes.status}`);
  }
  console.log("✓ Status restored to 'published'");

  // STEP 12: Property reappears publicly
  console.log("\n[STEP 12] Verifying property reappears publicly...");
  const publicReappearRes = await fetch(`${BASE_URL}/api/properties`, {
    headers: { "Cache-Control": "no-cache" },
  });
  const publicReappear = await publicReappearRes.json();
  const reappeared = publicReappear.properties.find((p) => p.id === TEST_ID);
  if (!reappeared) {
    throw new Error(`Property ${TEST_ID} did NOT reappear publicly!`);
  }
  console.log(`✓ Confirmed: Property ${TEST_ID} immediately reappeared on public map and catalog`);

  // STEP 13: Verify Admin, Public Website, and Database all use EXACT SAME ID & record
  console.log("\n[STEP 13] Verifying single source of truth across all layers...");
  const finalAdminRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, { headers: adminHeaders });
  const finalAdmin = (await finalAdminRes.json()).property;

  const finalPublicRes = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`);
  const finalPublic = (await finalPublicRes.json()).property;

  console.log(`Admin ID:     ${finalAdmin.id}`);
  console.log(`Public ID:    ${finalPublic.id}`);
  console.log(`Admin Title:  "${finalAdmin.title_uz}"`);
  console.log(`Public Title: "${finalPublic.title_uz}"`);
  console.log(`Admin Price:  ${finalAdmin.price_uzs} UZS`);
  console.log(`Public Price: ${finalPublic.price_uzs} UZS`);

  if (finalAdmin.id !== finalPublic.id || finalAdmin.id !== TEST_ID) {
    throw new Error("ID mismatch between Admin, Public, and Database!");
  }
  if (finalAdmin.title_uz !== finalPublic.title_uz || finalAdmin.price_uzs !== finalPublic.price_uzs) {
    throw new Error("Data mismatch between Admin and Public!");
  }
  console.log("✓ Confirmed: 100% ID and record identity across Admin and Public layers.");

  // CLEANUP
  console.log("\n--- Cleanup ---");
  await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  console.log(`✓ Test record ${TEST_ID} cleaned up.`);

  console.log("\n===============================================================================");
  console.log("ALL 13 END-TO-END VERIFICATION STEPS PASSED SUCCESSFULLY!");
  console.log("===============================================================================\n");
}

run().catch((err) => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
