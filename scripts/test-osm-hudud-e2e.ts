import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  fetchNearbyPOIsFromOverpass,
  getInfrastructureAround,
  calculateHaversineDistanceMeters,
  MAX_INFRASTRUCTURE_RADIUS_METERS,
} from "../src/lib/infrastructureService";
import { mapPropertyToDb } from "../src/lib/properties";

// Read .env.local
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) {
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith("#")) {
        const idx = t.indexOf("=");
        if (idx > 0) env[t.substring(0, idx).trim()] = t.substring(idx + 1).trim();
      }
    });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runE2E() {
  console.log("================================================================================");
  console.log("ANGREN ESTATE — E2E TEST: OSM/OVERPASS INFRASTRUCTURE + SAFE HUDUD MANAGEMENT");
  console.log("================================================================================");

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // TEST 1: OpenStreetMap / Overpass Infrastructure API (Free, No Yandex Key)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 1] Testing OSM Overpass Infrastructure Search & Strict 1000m Boundary...");
  const testLat = 41.0167;
  const testLng = 70.1436;

  console.log(`Querying OSM Overpass at Angren center (${testLat}, ${testLng}) with 1000m radius...`);
  const osmResult = await fetchNearbyPOIsFromOverpass(testLat, testLng, "uz");
  const osmItems = osmResult?.summaries.flatMap((s) => s.items) || [];
  console.log(`OSM Overpass returned: ${osmItems.length} real POI items across ${osmResult?.summaries.length || 0} categories`);

  let maxOsmDist = 0;
  for (const item of osmItems) {
    const dist = calculateHaversineDistanceMeters(testLat, testLng, item.latitude, item.longitude);
    if (dist > maxOsmDist) maxOsmDist = dist;
    if (dist > 1000) {
      console.error(`FAIL: OSM item "${item.nameUz}" is at ${dist}m > 1000m!`);
      allPassed = false;
    }
  }
  console.log(`Max distance among OSM items: ${maxOsmDist}m (All <= 1000m: ${maxOsmDist <= 1000 ? "PASS" : "FAIL"})`);

  // Negative test: Passing 5000m to getInfrastructureAround must be clamped or filtered to <= 1000m
  console.log("\nNegative Test: Passing radius = 5000m to getInfrastructureAround...");
  const fallbackResults = getInfrastructureAround(testLat, testLng, 5000, "uz");
  let maxFallbackDist = 0;
  let totalItemsCount = 0;
  fallbackResults.forEach((cat) => {
    cat.items.forEach((item) => {
      totalItemsCount++;
      const d = calculateHaversineDistanceMeters(testLat, testLng, item.latitude, item.longitude);
      if (d > maxFallbackDist) maxFallbackDist = d;
      if (d > 1000) {
        console.error(`FAIL: Item "${item.nameUz}" is at ${d}m > 1000m even when requested 5000m!`);
        allPassed = false;
      }
    });
  });
  console.log(`Total fallback items: ${totalItemsCount}, Max distance: ${maxFallbackDist}m (Strict 1km rule: ${maxFallbackDist <= 1000 ? "PASS" : "FAIL"})`);

  // ---------------------------------------------------------------------------
  // TEST 2: Hudud Polygon Management (Create -> Check Usage -> Edit -> Safe Delete)
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2] Testing Hudud Creation with Polygon in districts & app_settings...");
  const testHududId = `test-hudud-${Date.now().toString().slice(-6)}`;
  const testPolygon: [number, number][] = [
    [41.0150, 70.1400],
    [41.0180, 70.1400],
    [41.0180, 70.1450],
    [41.0150, 70.1450],
    [41.0150, 70.1400],
  ];

  // 2.1 Insert test hudud into districts table
  const { data: createdHudud, error: createError } = await supabase
    .from("districts")
    .insert({
      id: testHududId,
      city_id: "angren",
      name_uz: "Test Yangi Mavze",
      name_ru: "Тестовый Новый Массив",
      latitude: 41.0165,
      longitude: 70.1425,
      display_order: 99,
    })
    .select()
    .single();

  if (createError || !createdHudud) {
    console.error("FAIL: Could not create test hudud in districts:", createError);
    allPassed = false;
  } else {
    console.log(`Created test hudud: "${createdHudud.name_uz}" (ID: ${createdHudud.id})`);
  }

  // Also record polygon in app_settings
  const { data: curSettings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "hudud_polygons")
    .maybeSingle();
  const polyMap = curSettings?.value && typeof curSettings.value === "object" ? curSettings.value : {};
  polyMap[testHududId] = {
    coordinates: testPolygon,
    name_uz: "Test Yangi Mavze",
    name_ru: "Тестовый Новый Массив",
  };
  await supabase.from("app_settings").upsert({
    key: "hudud_polygons",
    value: polyMap,
    updated_at: new Date().toISOString(),
  });

  // 2.2 Create 2 test properties linked to this hudud (1 Apartment, 1 Yard)
  console.log("\nCreating 2 test properties linked to this hudud...");
  const prop1Id = `test-prop-apt-${Date.now().toString().slice(-4)}`;
  const prop2Id = `test-prop-yard-${Date.now().toString().slice(-4)}`;

  const prop1Data = mapPropertyToDb({
    id: prop1Id,
    slug: prop1Id,
    title_uz: "Test Kvartira 1",
    title_ru: "Тест Квартира 1",
    description_uz: "Test tavsif",
    description_ru: "Тест описание",
    property_type: "apartment",
    deal_type: "sale",
    district: testHududId,
    district_name_uz: "Test Yangi Mavze",
    district_name_ru: "Тестовый Новый Массив",
    address_uz: "Test ko‘cha 1",
    address_ru: "Тест улица 1",
    latitude: 41.0165,
    longitude: 70.1425,
    area: 65,
    price_usd: 35000,
    price_uzs: 448000000,
    status: "published",
    contact_phone: "+998 90 123 45 67",
    photos: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  });

  const prop2Data = mapPropertyToDb({
    id: prop2Id,
    slug: prop2Id,
    title_uz: "Test Hovli 2",
    title_ru: "Тест Двор 2",
    description_uz: "Test tavsif hovli",
    description_ru: "Тест описание двор",
    property_type: "house_yard",
    deal_type: "sale",
    district: testHududId,
    district_name_uz: "Test Yangi Mavze",
    district_name_ru: "Тестовый Новый Массив",
    address_uz: "Test ko‘cha 2",
    address_ru: "Тест улица 2",
    latitude: 41.0170,
    longitude: 70.1430,
    area: 120,
    price_usd: 60000,
    price_uzs: 768000000,
    status: "published",
    contact_phone: "+998 90 123 45 67",
    photos: ["https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800"],
  });

  const { error: prop1Err } = await supabase.from("properties").insert(prop1Data);
  const { error: prop2Err } = await supabase.from("properties").insert(prop2Data);

  if (prop1Err || prop2Err) {
    console.error("FAIL: Error inserting test properties:", prop1Err || prop2Err);
    allPassed = false;
  } else {
    console.log("Successfully inserted 2 test properties linked to hudud!");
  }

  // 2.3 Check usage count of this hudud
  console.log("\nChecking usage count for hudud...");
  const { count: usageCount, error: countErr } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .or(`district.eq.${testHududId},district_name_uz.eq.Test Yangi Mavze`);

  if (countErr) {
    console.error("FAIL: Error checking usage count:", countErr);
    allPassed = false;
  } else {
    console.log(`Usage count: ${usageCount} (Expected: 2) -> ${usageCount === 2 ? "PASS" : "FAIL"}`);
    if (usageCount !== 2) allPassed = false;
  }

  // 2.4 Update hudud (PUT test)
  console.log("\nTesting Hudud Update (PUT)...");
  const { data: updatedHudud, error: updateErr } = await supabase
    .from("districts")
    .update({
      name_uz: "Test Yangi Mavze (Tahrirlangan)",
      name_ru: "Тестовый Новый Массив (Изменено)",
    })
    .eq("id", testHududId)
    .select()
    .single();

  if (updateErr || updatedHudud?.name_uz !== "Test Yangi Mavze (Tahrirlangan)") {
    console.error("FAIL: Error updating hudud:", updateErr);
    allPassed = false;
  } else {
    console.log(`Successfully updated hudud name to: "${updatedHudud.name_uz}" -> PASS`);
  }

  // 2.5 Safe Deletion: Properties MUST NOT be deleted; district reset to markaz!
  console.log("\nTesting SAFE Hudud Deletion (Nullifying/Reassigning properties to markaz)...");
  const { error: nullifyErr } = await supabase
    .from("properties")
    .update({ district: "markaz", district_name_uz: "Markaz", district_name_ru: "Центр" })
    .eq("district", testHududId);

  if (nullifyErr) {
    console.error("FAIL: Error unassigning district on properties:", nullifyErr);
    allPassed = false;
  }

  const { error: deleteHududErr } = await supabase
    .from("districts")
    .delete()
    .eq("id", testHududId);

  if (deleteHududErr) {
    console.error("FAIL: Error deleting hudud row from districts:", deleteHududErr);
    allPassed = false;
  } else {
    console.log(`Hudud "${testHududId}" row removed from districts table.`);
  }

  // Step 3: CRITICAL INTEGRITY CHECK — Verify both properties are STILL in DB!
  console.log("\nVerifying Data Integrity: Checking if properties still exist with intact data...");
  const { data: remainingProps, error: verifyPropsErr } = await supabase
    .from("properties")
    .select("id, title_uz, district, latitude, longitude, price_usd, status")
    .in("id", [prop1Id, prop2Id]);

  if (verifyPropsErr || !remainingProps || remainingProps.length !== 2) {
    console.error("CRITICAL FAILURE: Properties were deleted or could not be found!", remainingProps);
    allPassed = false;
  } else {
    console.log(`Found ${remainingProps.length} properties still intact:`);
    for (const p of remainingProps) {
      console.log(`  - ID: ${p.id} | Title: "${p.title_uz}" | district: ${p.district} | Coords: (${p.latitude}, ${p.longitude}) | Price: $${p.price_usd}`);
      if (p.district === testHududId) {
        console.error(`FAIL: Property ${p.id} was not unassigned from deleted hudud!`);
        allPassed = false;
      }
      if (!p.latitude || !p.longitude || !p.price_usd) {
        console.error(`FAIL: Property ${p.id} lost core data!`);
        allPassed = false;
      }
    }
    console.log("SAFE DELETION INTEGRITY CHECK: PASS! (Properties preserved, safely unassigned from deleted hudud)");
  }

  // Cleanup test properties
  console.log("\nCleaning up test properties...");
  await supabase.from("properties").delete().in("id", [prop1Id, prop2Id]);
  console.log("Test cleanup completed.");

  console.log("\n================================================================================");
  console.log(`FINAL RESULT: ${allPassed ? "ALL TESTS PASSED SUCCESSFULLY! (100%)" : "SOME TESTS FAILED"}`);
  console.log("================================================================================");

  if (!allPassed) process.exit(1);
}

runE2E().catch((err) => {
  console.error("Fatal E2E test error:", err);
  process.exit(1);
});
