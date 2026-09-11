const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const DATA_FILE = path.join(__dirname, "..", "data", "properties.json");

const ENV_FILE = path.join(__dirname, "..", ".env.local");
let adminIdentifier = process.env.ADMIN_IDENTIFIER || "admin@angrenestate.uz";
let adminPassword = process.env.ADMIN_PASSWORD || "";
if (fs.existsSync(ENV_FILE)) {
  const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
  for (const line of lines) {
    if (line.startsWith("ADMIN_IDENTIFIER=")) {
      adminIdentifier = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, '');
    }
    if (line.startsWith("ADMIN_PASSWORD=")) {
      adminPassword = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function run() {
  console.log("===============================================================");
  console.log("ANGREN ESTATE — CANONICAL DATABASE E2E VERIFICATION (12 STEPS)");
  console.log("===============================================================\n");

  let adminCookie = "";

  // 0. Authenticate as Admin
  console.log("0. Authenticating as Admin...");
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: adminIdentifier,
      password: adminPassword,
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const setCookie = loginRes.headers.get("set-cookie");
  if (setCookie) {
    adminCookie = setCookie.split(";")[0];
  }
  const loginJson = await loginRes.json();
  console.log("✓ Admin authenticated successfully:", loginJson.user?.email);

  const adminHeaders = {
    "Content-Type": "application/json",
    Cookie: adminCookie,
  };

  const TEST_ID = "prop-e2e-test-live-1";

  // ---------------------------------------------------------------------------
  // STEP 1: Admin Create Property with status: draft
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 1: Admin creates property with status 'draft' ---");
  const createPayload = {
    id: TEST_ID,
    title_uz: "E2E Test Obyekti - Shifokorlar mavzesi",
    title_ru: "E2E Тестовый Объект - Массив Врачей",
    description_uz: "Yangi ta'mirlangan sinov obyekti.",
    description_ru: "Тестовый объект с ремонтом.",
    address_uz: "Angren sh., Shifokorlar ko'chasi, 12",
    address_ru: "г. Ангрен, ул. Врачей, 12",
    district_name_uz: "Markaz",
    district_name_ru: "Центр",
    transaction_type: "sale",
    deal_type: "sale",
    property_type: "apartment",
    status: "draft",
    price_uzs: 450000000,
    price_usd: 35000,
    area_sqm: 68,
    rooms: 3,
    floor: 3,
    total_floors: 5,
    renovation: "euro",
    coordinates: { lat: 41.0195, lng: 70.1425 },
    images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
    utilities: { gas: true, water: true, electricity: true, sewerage: true, heating: true },
    amenities: { furniture: true, parking: true, elevator: false, ac: true, balcony: true, internet: true },
    contact_phone: "+998 90 123 45 67",
  };

  const createRes = await fetch(`${BASE_URL}/api/admin/properties`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create property: ${createRes.status} ${await createRes.text()}`);
  }
  const createdJson = await createRes.json();
  console.log(`✓ Admin created property ID: ${createdJson.property.id}, status: ${createdJson.property.status}`);
  if (createdJson.property.status !== "draft") {
    throw new Error(`Expected status to be draft, got ${createdJson.property.status}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Confirm property is saved in the real database (data/properties.json)
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 2: Confirm property is saved in real canonical database ---");
  const rawDb = fs.readFileSync(DATA_FILE, "utf8");
  const dbData = JSON.parse(rawDb);
  const foundInDb = dbData.find((p) => p.id === TEST_ID);
  if (!foundInDb) {
    throw new Error(`Property ${TEST_ID} not found in canonical data/properties.json!`);
  }
  console.log(`✓ Confirmed: Property ${TEST_ID} exists in real database with status '${foundInDb.status}'`);

  // ---------------------------------------------------------------------------
  // STEP 3: In Admin Panel, change status to 'published'
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 3: Admin updates status to 'published' ---");
  const patchRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "published" }),
  });

  if (!patchRes.ok) {
    throw new Error(`Failed to patch status: ${patchRes.status} ${await patchRes.text()}`);
  }
  const patchedJson = await patchRes.json();
  console.log(`✓ Status updated in canonical DB to: ${patchedJson.property.status}`);
  if (patchedJson.property.status !== "published") {
    throw new Error(`Expected published status, got ${patchedJson.property.status}`);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Open Public Website endpoints (home map, buy page, rent page)
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 4: Public website fetches property data (unauthenticated) ---");
  const publicRes = await fetch(`${BASE_URL}/api/properties`);
  if (!publicRes.ok) {
    throw new Error(`Public GET /api/properties failed: ${publicRes.status}`);
  }
  const publicData = await publicRes.json();
  console.log(`✓ Public API returned ${publicData.count} published properties`);

  const publicDetailRes = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`);
  if (!publicDetailRes.ok) {
    throw new Error(`Public GET /api/properties/${TEST_ID} failed: ${publicDetailRes.status}`);
  }
  const publicDetailJson = await publicDetailRes.json();

  // ---------------------------------------------------------------------------
  // STEP 5: Confirm new property appears on public website with exact same data and ID
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 5: Confirm public property matches canonical record ---");
  const publicMatch = publicData.properties.find((p) => p.id === TEST_ID);
  if (!publicMatch) {
    throw new Error(`Property ${TEST_ID} did NOT appear in public properties list!`);
  }
  if (publicDetailJson.property.id !== TEST_ID) {
    throw new Error(`Public detail ID mismatch: expected ${TEST_ID}, got ${publicDetailJson.property.id}`);
  }
  console.log(`✓ Public Map & Catalog confirmed: ID: ${publicMatch.id}, Title: "${publicMatch.title_uz}", Price: ${publicMatch.price_uzs} UZS`);

  // ---------------------------------------------------------------------------
  // STEP 6: In Admin Panel, edit title and price
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 6: Admin edits property title and price ---");
  const NEW_TITLE = "Angren Markazida Elita Kvartira (E2E Test)";
  const NEW_PRICE = 750000000;
  const NEW_PRICE_USD = 58365;

  const editRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      title_uz: NEW_TITLE,
      price_uzs: NEW_PRICE,
      price_usd: NEW_PRICE_USD,
    }),
  });

  if (!editRes.ok) {
    throw new Error(`Failed to edit property: ${editRes.status} ${await editRes.text()}`);
  }
  const editJson = await editRes.json();
  console.log(`✓ Admin updated property: Title = "${editJson.property.title_uz}", Price = ${editJson.property.price_uzs}`);

  // ---------------------------------------------------------------------------
  // STEP 7: Verify public website immediately reflects edited data
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 7: Verify public website immediately reflects edited data ---");
  const verifyPublicEditRes = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`);
  const verifyPublicEditJson = await verifyPublicEditRes.json();
  if (verifyPublicEditJson.property.title_uz !== NEW_TITLE) {
    throw new Error(`Title mismatch! Expected "${NEW_TITLE}", got "${verifyPublicEditJson.property.title_uz}"`);
  }
  if (verifyPublicEditJson.property.price_uzs !== NEW_PRICE) {
    throw new Error(`Price mismatch! Expected ${NEW_PRICE}, got ${verifyPublicEditJson.property.price_uzs}`);
  }
  console.log(`✓ Public website verified: Title: "${verifyPublicEditJson.property.title_uz}", Price: ${verifyPublicEditJson.property.price_uzs} UZS`);

  // ---------------------------------------------------------------------------
  // STEP 8: In Admin Panel, change status back to 'draft'
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 8: Admin unpublishes property (changes status to draft) ---");
  const unpublishRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "draft" }),
  });
  if (!unpublishRes.ok) {
    throw new Error(`Failed to change status to draft: ${unpublishRes.status}`);
  }
  console.log("✓ Admin successfully set status to 'draft'");

  // ---------------------------------------------------------------------------
  // STEP 9: Confirm property immediately disappears from public website
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 9: Confirm property immediately disappears from public website ---");
  const publicAfterUnpublish = await fetch(`${BASE_URL}/api/properties`);
  const publicAfterData = await publicAfterUnpublish.json();
  const foundAfterUnpublish = publicAfterData.properties.find((p) => p.id === TEST_ID);
  if (foundAfterUnpublish) {
    throw new Error(`Draft property ${TEST_ID} is still visible in public /api/properties list!`);
  }

  const publicDetailAfterDraft = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`);
  if (publicDetailAfterDraft.status !== 404) {
    throw new Error(`Expected 404 for draft property on public endpoint, got status ${publicDetailAfterDraft.status}`);
  }
  console.log("✓ Confirmed: Draft property is completely hidden from public map, listings, and detail page (HTTP 404)");

  // ---------------------------------------------------------------------------
  // STEP 10: In Admin Panel, change status back to 'published'
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 10: Admin re-publishes property ---");
  const republishRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "published" }),
  });
  if (!republishRes.ok) {
    throw new Error(`Failed to re-publish: ${republishRes.status}`);
  }
  console.log("✓ Admin successfully set status back to 'published'");

  // ---------------------------------------------------------------------------
  // STEP 11: Confirm property reappears on public website
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 11: Confirm property reappears on public website ---");
  const publicAfterRepublish = await fetch(`${BASE_URL}/api/properties`);
  const publicRepublishData = await publicAfterRepublish.json();
  const foundAfterRepublish = publicRepublishData.properties.find((p) => p.id === TEST_ID);
  if (!foundAfterRepublish) {
    throw new Error(`Re-published property ${TEST_ID} did not re-appear in public list!`);
  }
  console.log(`✓ Confirmed: Re-published property ${TEST_ID} is immediately visible again to the public`);

  // ---------------------------------------------------------------------------
  // STEP 12: Verify Admin Panel and Public Website read/write the exact same ID & record
  // ---------------------------------------------------------------------------
  console.log("\n--- STEP 12: Verify single source of truth (Admin vs Public vs Database) ---");
  const adminGet = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, { headers: adminHeaders });
  const adminRecord = (await adminGet.json()).property;

  const publicGet = await fetch(`${BASE_URL}/api/properties/${TEST_ID}`);
  const publicRecord = (await publicGet.json()).property;

  const diskDb = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const diskRecord = diskDb.find((p) => p.id === TEST_ID);

  console.log(`Admin ID:    ${adminRecord.id}`);
  console.log(`Public ID:   ${publicRecord.id}`);
  console.log(`Database ID: ${diskRecord.id}`);

  if (adminRecord.id !== publicRecord.id || publicRecord.id !== diskRecord.id) {
    throw new Error("ID mismatch between Admin, Public, and Database!");
  }
  if (adminRecord.title_uz !== publicRecord.title_uz || publicRecord.title_uz !== diskRecord.title_uz) {
    throw new Error("Title mismatch between Admin, Public, and Database!");
  }
  if (adminRecord.price_uzs !== publicRecord.price_uzs || publicRecord.price_uzs !== diskRecord.price_uzs) {
    throw new Error("Price mismatch between Admin, Public, and Database!");
  }
  console.log("✓ Confirmed: EXACT SAME ID, TITLE, AND PRICE across Admin, Public, and Canonical Storage!");

  // Cleanup: Delete the test property
  console.log("\n--- Cleanup: Delete test property ---");
  const deleteRes = await fetch(`${BASE_URL}/api/admin/properties/${TEST_ID}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  if (deleteRes.ok) {
    console.log(`✓ Test property ${TEST_ID} cleanly deleted.`);
  }

  console.log("\n===============================================================");
  console.log("ALL 12 VERIFICATION TESTS PASSED SUCCESSFULLY! 100% UNIFIED.");
  console.log("===============================================================\n");
}

run().catch((err) => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
