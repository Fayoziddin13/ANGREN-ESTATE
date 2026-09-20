import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  getInfrastructureAround,
  calculateHaversineDistanceMeters,
  MAX_INFRASTRUCTURE_RADIUS_METERS,
} from "@/lib/infrastructureService";
import { mapPropertyToDb } from "@/lib/properties";

// Read .env.local
const env: Record<string, string> = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith("#")) {
      const idx = t.indexOf("=");
      if (idx > 0) env[t.substring(0, idx).trim()] = t.substring(idx + 1).trim();
    }
  });

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runE2ETests() {
  console.log("================================================================================");
  console.log("ANGREN ESTATE — E2E TEST: REAL NEARBY INFRASTRUCTURE (1 KM RADIUS)");
  console.log("================================================================================");

  // 1. Clean any existing properties to ensure EXACTLY TWO
  const { data: existingProps } = await supabase.from("properties").select("id");
  if (existingProps && existingProps.length > 0) {
    console.log(`Cleaning ${existingProps.length} existing properties for pristine test run...`);
    for (const p of existingProps) {
      await supabase.from("properties").delete().eq("id", p.id);
    }
  }

  // 2. CREATE PROPERTY 1: APARTMENT (6-mavze)
  const aptLat = 41.0190;
  const aptLng = 70.1320;
  console.log(`\n--- STEP A-H: Testing Apartment at 6-mavze (${aptLat}, ${aptLng}) ---`);

  // Step D: Calculate / Detect Nearby Infrastructure
  const aptInfraUz = getInfrastructureAround(aptLat, aptLng, 1000, "uz");
  const aptInfraRu = getInfrastructureAround(aptLat, aptLng, 1000, "ru");

  console.log(`Infrastructure categories found around Apartment: ${aptInfraUz.length}`);
  let aptItemCount = 0;
  let aptMaxDistance = 0;

  aptInfraUz.forEach((summary) => {
    summary.items.forEach((item) => {
      aptItemCount++;
      const exactDistance = calculateHaversineDistanceMeters(aptLat, aptLng, item.latitude, item.longitude);
      if (exactDistance > aptMaxDistance) aptMaxDistance = exactDistance;
      console.log(`  - [${summary.category}] ${item.nameUz} | ${exactDistance}m (Formatted: ${item.formattedDistance})`);
      if (exactDistance > 1000) {
        throw new Error(`VIOLATION: ${item.nameUz} is ${exactDistance}m away, which exceeds 1000m!`);
      }
    });
  });

  console.log(`Apartment Total Verified Objects: ${aptItemCount} (All <= 1000m, max: ${aptMaxDistance}m)`);

  // Insert Apartment into DB
  const aptPayload = {
    id: "prop-apt-6mavze",
    title_uz: "6-mavzeda zamonaviy 3 xonali shinam kvartira",
    title_ru: "Современная 3-комнатная уютная квартира в 6-м микрорайоне",
    description_uz: "6-mavzeda joylashgan barcha qulayliklarga ega 3 xonali shinam kvartira sotiladi. Maktab, bog‘cha va do‘konlar 1 km radiusda joylashgan.",
    description_ru: "Продается отличная 3-комнатная квартира в 6-м микрорайоне со всеми удобствами. Школы, детсады и магазины в радиусе 1 км.",
    property_type: "apartment",
    deal_type: "sale",
    district: "6-mavze",
    address_uz: "6-mavze, 14-uy",
    address_ru: "6-й микрорайон, дом 14",
    latitude: aptLat,
    longitude: aptLng,
    coordinates: { lat: aptLat, lng: aptLng },
    price_usd: 42000,
    price_uzs: 537600000,
    price_negotiable: true,
    rooms: 3,
    area_sqm: 65,
    floor: 4,
    total_floors: 9,
    renovation: "euro",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&auto=format&fit=crop&q=80",
    ],
    video_url: "https://youtube.com/watch?v=test_apartment_angren",
    realtor_id: "539220ed-1ddd-4ba5-8174-a999f60acff5",
    owner_phone: "+998901234567",
    status: "published",
    amenities: {
      furniture: true,
      parking: true,
      balcony: true,
      elevator: true,
      ac: true,
      internet: true,
      note_uz: "Sifatli ta’mirlangan, yashash uchun barcha sharoitlar tayyor.",
      note_ru: "Качественный ремонт, всё готово к комфортному проживанию.",
    },
    utilities: {
      electricity: true,
      gas: true,
      water: true,
      heating: true,
    },
  };

  const { data: aptData, error: aptError } = await supabase.from("properties").insert([mapPropertyToDb(aptPayload)]).select().single();
  if (aptError) throw new Error("Failed to insert test apartment: " + aptError.message);
  console.log("Apartment successfully published to database: ID =", aptData.id);

  // 3. CREATE PROPERTY 2: HOUSE/YARD (Dukent)
  const houseLat = 41.0380;
  const houseLng = 70.1750;
  console.log(`\n--- STEP A-H: Testing House/Yard at Dukent (${houseLat}, ${houseLng}) ---`);

  // Step D: Calculate / Detect Nearby Infrastructure
  const houseInfraUz = getInfrastructureAround(houseLat, houseLng, 1000, "uz");
  const houseInfraRu = getInfrastructureAround(houseLat, houseLng, 1000, "ru");

  console.log(`Infrastructure categories found around House/Yard: ${houseInfraRu.length}`);
  let houseItemCount = 0;
  let houseMaxDistance = 0;

  houseInfraRu.forEach((summary) => {
    summary.items.forEach((item) => {
      houseItemCount++;
      const exactDistance = calculateHaversineDistanceMeters(houseLat, houseLng, item.latitude, item.longitude);
      if (exactDistance > houseMaxDistance) houseMaxDistance = exactDistance;
      console.log(`  - [${summary.category}] ${item.nameRu} | ${exactDistance}m (Formatted: ${item.formattedDistance})`);
      if (exactDistance > 1000) {
        throw new Error(`VIOLATION: ${item.nameRu} is ${exactDistance}m away, which exceeds 1000m!`);
      }
    });
  });

  console.log(`House Total Verified Objects: ${houseItemCount} (All <= 1000m, max: ${houseMaxDistance}m)`);

  // Insert House/Yard into DB
  const housePayload = {
    id: "prop-house-dukent",
    title_uz: "Dukentda barcha qulayliklarga ega 6 sotixli shinam hovli",
    title_ru: "Уютный дом 6 соток со всеми удобствами в Дукенте",
    description_uz: "Dukent hududida joylashgan 6 sotixli, keng hovliga ega 5 xonali pishiq g‘ishtli hovli sotiladi. Maktab, poliklinika va bog‘cha yaqinida.",
    description_ru: "Продается отличный 5-комнатный дом на 6 сотках в Дукенте со всеми удобствами. Рядом школа, СВП и детский сад.",
    property_type: "house_yard",
    deal_type: "sale",
    district: "Dukent",
    address_uz: "Dukent qishlog‘i, Bo‘ston ko‘chasi",
    address_ru: "поселок Дукент, улица Бустон",
    latitude: houseLat,
    longitude: houseLng,
    coordinates: { lat: houseLat, lng: houseLng },
    price_usd: 65000,
    price_uzs: 832000000,
    price_negotiable: true,
    rooms: 5,
    area_sqm: 140,
    area_sotikh: 6,
    facade_m: 15,
    depth_m: 40,
    dimensions: "15 × 40 m",
    renovation: "euro",
    images: [
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=80",
    ],
    video_url: "https://youtube.com/watch?v=test_house_angren",
    realtor_id: "6b6045b4-bcab-4ae3-9b99-9356acb45f51",
    owner_phone: "+998939876543",
    status: "published",
    amenities: {
      green_zone: true,
      garage: true,
      pool: true,
      storage: true,
      note_uz: "Hovlida mevali daraxtlar va yozgi oshxona mavjud.",
      note_ru: "Во дворе есть фруктовый сад и летняя кухня.",
    },
    utilities: {
      electricity: true,
      gas: true,
      water: true,
      heating: true,
    },
  };

  const { data: houseData, error: houseError } = await supabase.from("properties").insert([mapPropertyToDb(housePayload)]).select().single();
  if (houseError) throw new Error("Failed to insert test house: " + houseError.message);
  console.log("House/Yard successfully published to database: ID =", houseData.id);

  // 4. STEP N-P: DYNAMIC RECALCULATION TEST (Changing location updates infrastructure)
  console.log("\n--- STEP N-P: Testing Dynamic Location Change ---");
  const tempCenterLat = 41.0167; // Markaz
  const tempCenterLng = 70.1436;
  const tempCenterInfra = getInfrastructureAround(tempCenterLat, tempCenterLng, 1000, "uz");
  console.log(`When moving pin to Markaz (${tempCenterLat}, ${tempCenterLng}):`);
  console.log(`Found ${tempCenterInfra.length} categories.`);
  const hasCentralMarket = tempCenterInfra.some((s) => s.items.some((i) => i.id === "mkt-central"));
  console.log(`Does Markaz have Central Market? ${hasCentralMarket ? "YES (CORRECT)" : "NO"}`);
  if (!hasCentralMarket) throw new Error("Markaz should include Central Market within 1km!");

  // Verify that Dukent does NOT have Central Market
  const dukentHasCentralMarket = houseInfraUz.some((s) => s.items.some((i) => i.id === "mkt-central"));
  console.log(`Does Dukent have Central Market? ${dukentHasCentralMarket ? "YES (BUG!)" : "NO (CORRECT)"}`);
  if (dukentHasCentralMarket) throw new Error("Dukent is >3km from Central Market, must NOT contain it!");

  // 5. NEGATIVE DISTANCE TEST (> 1000m)
  console.log("\n--- NEGATIVE TEST (> 1000m objects strictly excluded) ---");
  // Test TMO hospital from 6-mavze
  const tmoDist = calculateHaversineDistanceMeters(aptLat, aptLng, 41.0195, 70.1510);
  console.log(`Distance from 6-mavze apartment to TMO Hospital: ${tmoDist}m (>1000m)`);
  const aptHasTmo = aptInfraUz.some((s) => s.items.some((i) => i.id === "hosp-tmo"));
  if (aptHasTmo) throw new Error("FAILURE: TMO hospital appeared in 6-mavze!");
  console.log("PASS: TMO Hospital (>1000m) is excluded.");

  // Test Dukent school from 6-mavze
  const dukentSchoolDist = calculateHaversineDistanceMeters(aptLat, aptLng, 41.0375, 70.1740);
  console.log(`Distance from 6-mavze apartment to Dukent School 24: ${dukentSchoolDist}m (>1000m)`);
  const aptHasDukentSchool = aptInfraUz.some((s) => s.items.some((i) => i.id === "sch-dukent24"));
  if (aptHasDukentSchool) throw new Error("FAILURE: Dukent school appeared in 6-mavze!");
  console.log("PASS: Dukent School (>1000m) is excluded.");

  // Remote mountain coordinate test
  const remoteSummaries = getInfrastructureAround(41.1500, 70.3500, 1000, "uz");
  console.log(`Remote coordinates (41.15, 70.35) returned: ${remoteSummaries.length} categories`);
  if (remoteSummaries.length !== 0) throw new Error("Remote coordinate must return 0 items!");
  console.log("PASS: Remote coordinate returns 0 items.");

  // 6. VERIFY DATABASE INTEGRITY & EXACT TWO TEST PROPERTIES
  console.log("\n--- VERIFY EXACT TWO TEST PROPERTIES IN DATABASE ---");
  const { data: finalProps } = await supabase.from("properties").select("id, title_uz, property_type, district, latitude, longitude, status");
  console.log(`Total properties currently in DB: ${finalProps?.length}`);
  finalProps?.forEach((p) => {
    console.log(`  - [${p.property_type}] ${p.title_uz} (District: ${p.district}, Lat: ${p.latitude}, Lng: ${p.longitude})`);
  });

  if (!finalProps || finalProps.length !== 2) {
    throw new Error(`FAILURE: Expected exactly 2 test properties, but found ${finalProps?.length}!`);
  }

  console.log("\n================================================================================");
  console.log("ALL E2E REAL NEARBY INFRASTRUCTURE & 1 KM RADIUS TESTS PASSED!");
  console.log("================================================================================");
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
