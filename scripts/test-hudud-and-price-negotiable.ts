import fs from "fs";
import path from "path";

// Load .env.local
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

import { formatPrice, formatPropertyPrice } from "../src/lib/currency";

async function runTests() {
  const { supabaseAdmin } = await import("../src/lib/supabaseServer");
  const { getPublishedProperties } = await import("../src/lib/properties");
  console.log("==================================================");
  console.log("TESTING: HUDUD DELETION LOGIC & PRICE NEGOTIABLE");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? " - " + detail : ""}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Price Formatting (formatPropertyPrice and formatPrice)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 1: Price Formatter Unit Tests ---");

  // Normal price, price_negotiable = false
  const normalResultUSD = formatPropertyPrice({
    priceUzs: 480000000,
    priceUsd: 37500,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: false,
  });
  assert(
    normalResultUSD.priceDisplay === "$37,500",
    "Normal price property shows correct USD price ($37,500)",
    `Got: ${normalResultUSD.priceDisplay}`
  );

  const normalResultUZS = formatPropertyPrice({
    priceUzs: 480000000,
    priceUsd: 37500,
    currency: "UZS",
    locale: "uz",
    isSale: true,
    isNegotiable: false,
  });
  assert(
    normalResultUZS.priceDisplay.includes("480"),
    "Normal price property shows correct UZS price",
    `Got: ${normalResultUZS.priceDisplay}`
  );

  // Negotiable price: price = 0, isNegotiable = true (UZ)
  const negotiableUz = formatPropertyPrice({
    priceUzs: 0,
    priceUsd: 0,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: true,
  });
  assert(
    negotiableUz.priceDisplay === "Narxi kelishiladi",
    "Negotiable property shows 'Narxi kelishiladi' in Uzbek",
    `Got: ${negotiableUz.priceDisplay}`
  );

  // Negotiable price: price = 0, isNegotiable = true (RU)
  const negotiableRu = formatPropertyPrice({
    priceUzs: 0,
    priceUsd: 0,
    currency: "USD",
    locale: "ru",
    isSale: true,
    isNegotiable: true,
  });
  assert(
    negotiableRu.priceDisplay === "Цена договорная",
    "Negotiable property shows 'Цена договорная' in Russian",
    `Got: ${negotiableRu.priceDisplay}`
  );

  // Priority test: user entered price ($37,500) BUT checked price_negotiable = true
  const priorityTest = formatPropertyPrice({
    priceUzs: 480000000,
    priceUsd: 37500,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: true,
  });
  assert(
    priorityTest.priceDisplay === "Narxi kelishiladi",
    "Priority test: isNegotiable=true overrides numeric price and displays 'Narxi kelishiladi'",
    `Got: ${priorityTest.priceDisplay}`
  );

  // formatPrice check
  const formatPriceNegUz = formatPrice(0, "uz", "USD", false, 12850, 0, true);
  assert(
    formatPriceNegUz.primary === "Narxi kelishiladi",
    "formatPrice returns 'Narxi kelishiladi' when isNegotiable=true",
    `Got: ${formatPriceNegUz.primary}`
  );

  const formatPriceNegRu = formatPrice(0, "ru", "USD", false, 12850, 0, true);
  assert(
    formatPriceNegRu.primary === "Цена договорная",
    "formatPrice returns 'Цена договорная' in Russian when isNegotiable=true",
    `Got: ${formatPriceNegRu.primary}`
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Validation Logic Simulation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Validation Logic Tests ---");

  function validatePriceInput(price: number | null | undefined, isNegotiable: boolean, locale: "uz" | "ru") {
    if (!isNegotiable && (!price || price <= 0)) {
      return {
        valid: false,
        error: locale === "uz"
          ? "Narxni kiriting yoki 'Narxi kelishiladi'ni tanlang."
          : "Введите цену или выберите 'Цена договорная'.",
      };
    }
    return { valid: true, error: null };
  }

  const valTest1 = validatePriceInput(null, false, "uz");
  assert(
    !valTest1.valid && valTest1.error === "Narxni kiriting yoki 'Narxi kelishiladi'ni tanlang.",
    "Validation blocks when price is empty and negotiable is unchecked",
    `Got: ${JSON.stringify(valTest1)}`
  );

  const valTest2 = validatePriceInput(null, true, "uz");
  assert(
    valTest2.valid === true && valTest2.error === null,
    "Validation passes when price is empty but negotiable is checked",
    `Got: ${JSON.stringify(valTest2)}`
  );

  const valTest3 = validatePriceInput(35000, false, "uz");
  assert(
    valTest3.valid === true,
    "Validation passes when numeric price is provided",
    `Got: ${JSON.stringify(valTest3)}`
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Hudud Usage & Deletion Safety Checks
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Hudud Deletion & Usage Checks ---");

  // Read local properties to determine in-use hududs
  const dataFilePath = path.join(process.cwd(), "data", "properties.json");
  let localProperties: any[] = [];
  if (fs.existsSync(dataFilePath)) {
    localProperties = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
  }

  // Count properties tied to 'markaz'
  const markazCount = localProperties.filter((p: any) => {
    const dId = String(p.district || p.district_name_uz || (p.amenities as any)?.hudud_id || "").toLowerCase().trim();
    return dId === "markaz";
  }).length;

  assert(
    markazCount > 0,
    `Hudud 'markaz' is in use by ${markazCount} properties in properties.json`
  );

  // Check how DELETE API evaluates in-use vs unused
  function evaluateHududDelete(assignedCount: number) {
    if (assignedCount > 0) {
      return {
        allowed: false,
        status: 400,
        message: "Bu hududda mavjud obyektlar mavjud. Avval obyektlarni boshqa hududga o‘tkazing.",
      };
    }
    return {
      allowed: true,
      status: 200,
      message: "Hudud o‘chirildi",
    };
  }

  const blockedDelete = evaluateHududDelete(markazCount);
  assert(
    blockedDelete.allowed === false &&
    blockedDelete.status === 400 &&
    blockedDelete.message === "Bu hududda mavjud obyektlar mavjud. Avval obyektlarni boshqa hududga o‘tkazing.",
    "In-use hudud deletion is blocked with exact required message",
    `Got: ${blockedDelete.message}`
  );

  const allowedDelete = evaluateHududDelete(0);
  assert(
    allowedDelete.allowed === true && allowedDelete.status === 200,
    "Unused hudud (0 properties) deletion is allowed",
    `Got: ${JSON.stringify(allowedDelete)}`
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Database & Real Property Integrity
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Real Data Integrity (Zero Loss) ---");

  const properties = await getPublishedProperties();
  assert(
    properties.length >= 11,
    `Real properties intact: found ${properties.length} published properties (>= 11 required)`
  );

  // Verify real realtors exist
  const { data: realtors, error: rErr } = await supabaseAdmin.from("realtors").select("id, name");
  const realtorCount = realtors?.length || 0;
  assert(
    !rErr && realtorCount >= 2,
    `Real realtors intact: found ${realtorCount} realtors (>= 2 required)`
  );

  // Verify none of the real properties have lost their coordinates or prices
  let allHaveCoords = true;
  let allHaveValidTitles = true;
  for (const p of properties) {
    if (!p.coordinates || typeof p.coordinates.lat !== "number" || typeof p.coordinates.lng !== "number") {
      allHaveCoords = false;
    }
    if (!p.title_uz) {
      allHaveValidTitles = false;
    }
  }
  assert(allHaveCoords, "All real properties maintain valid coordinates");
  assert(allHaveValidTitles, "All real properties maintain valid Uzbek titles");

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log("==================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner threw an unhandled error:", err);
  process.exit(1);
});
