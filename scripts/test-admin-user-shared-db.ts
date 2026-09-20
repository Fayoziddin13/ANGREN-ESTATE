import fs from "fs";
import {
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyById,
  getPublishedProperties,
  sanitizePublicProperty,
} from "../src/lib/properties";

// Verify environment
if (fs.existsSync(".env.local")) {
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const idx = t.indexOf("=");
        if (idx > 0) {
          const key = t.substring(0, idx).trim();
          const val = t.substring(idx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
}

async function testSharedDbSync() {
  console.log("================================================================================");
  console.log("TEST: ADMIN PANEL <-> USER PAGE SHARED DATABASE & REAL-TIME VISIBILITY");
  console.log("================================================================================");

  let passed = true;
  const testId = `sync-test-${Date.now().toString().slice(-6)}`;

  // 1. Admin creates a new property
  console.log(`\n[STEP 1] Admin creates property "${testId}" in published status...`);
  const created = await createProperty({
    id: testId,
    title_uz: "Sinxronizatsiya Kvartirasi",
    title_ru: "Квартира для Синхронизации",
    description_uz: "Ushbu obyekt admin va user umumiy bazasini tekshirish uchun",
    description_ru: "Этот объект создан для проверки синхронизации админки и сайта",
    property_type: "apartment",
    deal_type: "sale",
    status: "published",
    price_usd: 45000,
    price_uzs: 576000000,
    area: 72,
    rooms: 3,
    floor: 4,
    total_floors: 9,
    district: "markaz",
    district_name_uz: "Markaz",
    district_name_ru: "Центр",
    address_uz: "Amir Temur ko‘chasi, 15",
    address_ru: "ул. Амира Темура, 15",
    latitude: 41.018,
    longitude: 70.145,
    contact_phone: "+998 90 123 45 67",
    owner_phone: "+998 99 999 88 77",
    utilities: { gas: true, electricity: true, water: true, heating: true, sewerage: true },
    amenities: { ac: true, furniture: true, parking: false, elevator: false, balcony: false, internet: true },
  } as any);

  if (!created || created.id !== testId) {
    console.error("FAIL: Could not create property in DB!", created);
    passed = false;
  } else {
    console.log(`Admin successfully created property ID: ${created.id}`);
  }

  // 2. User page fetches published properties
  console.log("\n[STEP 2] User page fetches published properties list & single item...");
  const publishedList = await getPublishedProperties();
  const foundInPublicList = publishedList.find((p) => p.id === testId);

  if (!foundInPublicList) {
    console.error("FAIL: Created property NOT found in published properties list!");
    passed = false;
  } else {
    console.log(`PASS: Found created property in user public list (Total: ${publishedList.length})`);
  }

  const publicProperty = await getPropertyById(testId);
  if (!publicProperty) {
    console.error("FAIL: getPropertyById returned null for user!");
    passed = false;
  } else {
    console.log(`PASS: getPropertyById retrieved property: "${publicProperty.title_uz}", Price: $${publicProperty.price_usd}`);
  }

  // 3. Privacy Check: owner_phone must be sanitized for public views
  console.log("\n[STEP 3] Verifying data privacy sanitation for public user...");
  if (publicProperty) {
    const sanitized = sanitizePublicProperty(publicProperty);
    if ((sanitized as any).owner_phone) {
      console.error("FAIL: owner_phone leaked to sanitized public property!");
      passed = false;
    } else {
      console.log("PASS: owner_phone correctly omitted from public view.");
    }
  }

  // 4. Admin updates property price and title
  console.log("\n[STEP 4] Admin updates price to $49,000 and title in Admin Panel...");
  const updated = await updateProperty(testId, {
    price_usd: 49000,
    price_uzs: 627200000,
    title_uz: "Sinxronizatsiya Kvartirasi (Yangilangan)",
    title_ru: "Квартира для Синхронизации (Обновлено)",
  });

  if (!updated || updated.price_usd !== 49000) {
    console.error("FAIL: Admin update failed!", updated);
    passed = false;
  } else {
    console.log("Admin update saved to DB.");
  }

  // 5. User page verifies immediate reflection of updated data
  console.log("\n[STEP 5] User page re-queries property to verify updated data...");
  const userViewUpdated = await getPropertyById(testId);
  if (!userViewUpdated || userViewUpdated.price_usd !== 49000 || userViewUpdated.title_uz !== "Sinxronizatsiya Kvartirasi (Yangilangan)") {
    console.error("FAIL: User did NOT see updated price or title!", userViewUpdated);
    passed = false;
  } else {
    console.log(`PASS: User page sees updated price ($${userViewUpdated.price_usd}) and updated title ("${userViewUpdated.title_uz}")!`);
  }

  // 6. Admin changes status to draft (unpublished)
  console.log("\n[STEP 6] Admin unpublishes property (status: 'draft')...");
  await updateProperty(testId, { status: "draft" });

  const publishedAfterDraft = await getPublishedProperties();
  const foundDraftInPublic = publishedAfterDraft.find((p) => p.id === testId);
  if (foundDraftInPublic) {
    console.error("FAIL: Draft property is still visible in user public list!");
    passed = false;
  } else {
    console.log("PASS: Draft property is hidden from user public list.");
  }

  // 7. Cleanup: Delete test property permanently
  console.log("\n[STEP 7] Cleaning up test property permanently...");
  const deleted = await deleteProperty(testId);
  console.log(`Cleaned up test property: ${deleted ? "SUCCESS" : "FAIL"}`);

  console.log("\n================================================================================");
  console.log(`RESULT: ${passed ? "ALL SHARED DB CHECKS PASSED SUCCESSFULLY! (100%)" : "FAILED"}`);
  console.log("================================================================================");

  if (!passed) process.exit(1);
}

testSharedDbSync().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
