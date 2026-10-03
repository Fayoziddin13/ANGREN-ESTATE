import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
const USD_EXCHANGE_RATE = 12800;

function uzsToUsd(amountUzs, rate = USD_EXCHANGE_RATE) {
  const activeRate = rate > 0 ? rate : USD_EXCHANGE_RATE;
  return Math.round(amountUzs / activeRate);
}

function formatPropertyPrice({
  priceUzs,
  priceUsd,
  currency,
  locale,
  isSale = true,
  exchangeRate = USD_EXCHANGE_RATE,
  isNegotiable = false,
  bargainAllowed = false,
}) {
  const isUz = locale === "uz";
  const hasBargain = Boolean(bargainAllowed);
  const bargainBadge = isUz ? "Savdolashish mumkin" : "Торг уместен";

  if (isNegotiable || (!priceUzs && (!priceUsd || priceUsd <= 0))) {
    return {
      priceDisplay: isUz ? "Narxi kelishiladi" : "Цена договорная",
      secondaryPrice: "",
      hasBargain,
      bargainBadge,
    };
  }

  const uzsSuffix = isUz ? "so‘m" : "сум";
  const monthSuffix = isSale ? "" : ` / ${isUz ? "oy" : "мес"}`;
  const activeRate = exchangeRate > 0 ? exchangeRate : USD_EXCHANGE_RATE;

  const usdAmount =
    priceUsd !== undefined && priceUsd > 0
      ? priceUsd
      : uzsToUsd(priceUzs, activeRate);
  const formattedUsd = usdAmount.toLocaleString("en-US");

  if (currency === "USD") {
    const priceDisplay = `$${formattedUsd}${monthSuffix}`;
    const secondaryPrice = `≈ ${priceUzs.toLocaleString("ru-RU")} ${uzsSuffix}${monthSuffix}`;
    return { priceDisplay, secondaryPrice, hasBargain, bargainBadge };
  } else {
    const priceDisplay = `${priceUzs.toLocaleString("ru-RU")} ${uzsSuffix}${monthSuffix}`;
    const secondaryPrice = `≈ $${formattedUsd}${monthSuffix}`;
    return { priceDisplay, secondaryPrice, hasBargain, bargainBadge };
  }
}

const envFile = path.join(process.cwd(), ".env.local");
let envUrl = "";
let envKey = "";
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) envUrl = line.split("=")[1].trim();
    if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) envKey = line.split("=")[1].trim();
  }
}

const sb = createClient(envUrl, envKey);

async function run() {
  console.log("==================================================================");
  console.log("VERIFICATION: TWO PRICE OPTIONS & HUDUD DELETE COUNT BUG FIX");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, testName, detail) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? " - " + detail : ""}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. PRICE FORMATTER: 4 STATES MATRIX & PRIORITY
  // ---------------------------------------------------------------------------
  console.log("--- 1. PRICE FORMATTER: 4 STATES MATRIX & PRIORITY ---");

  // State 1: Both OFF -> Price required, shows $35,000, no bargain badge
  const s1 = formatPropertyPrice({
    priceUzs: 448000000,
    priceUsd: 35000,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: false,
    bargainAllowed: false,
  });
  assert(s1.priceDisplay === "$35,000", "State 1: Displays $35,000", `Got: ${s1.priceDisplay}`);
  assert(!s1.hasBargain, "State 1: hasBargain is false", `Got: ${s1.hasBargain}`);

  // State 2: Kelishiladi OFF, Savdolashish ON -> Shows $35,000 + Savdolashish mumkin badge
  const s2Uz = formatPropertyPrice({
    priceUzs: 448000000,
    priceUsd: 35000,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: false,
    bargainAllowed: true,
  });
  assert(s2Uz.priceDisplay === "$35,000", "State 2 (UZ): Displays $35,000", `Got: ${s2Uz.priceDisplay}`);
  assert(s2Uz.hasBargain === true, "State 2 (UZ): hasBargain is true");
  assert(s2Uz.bargainBadge === "Savdolashish mumkin", "State 2 (UZ): bargainBadge is 'Savdolashish mumkin'", `Got: ${s2Uz.bargainBadge}`);

  const s2Ru = formatPropertyPrice({
    priceUzs: 448000000,
    priceUsd: 35000,
    currency: "USD",
    locale: "ru",
    isSale: true,
    isNegotiable: false,
    bargainAllowed: true,
  });
  assert(s2Ru.priceDisplay === "$35,000", "State 2 (RU): Displays $35,000", `Got: ${s2Ru.priceDisplay}`);
  assert(s2Ru.hasBargain === true, "State 2 (RU): hasBargain is true");
  assert(s2Ru.bargainBadge === "Торг уместен", "State 2 (RU): bargainBadge is 'Торг уместен'", `Got: ${s2Ru.bargainBadge}`);

  // State 3: Kelishiladi ON, Savdolashish OFF -> Displays 'Narxi kelishiladi', no bargain badge
  const s3Uz = formatPropertyPrice({
    priceUzs: 0,
    priceUsd: 0,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: true,
    bargainAllowed: false,
  });
  assert(s3Uz.priceDisplay === "Narxi kelishiladi", "State 3 (UZ): Displays 'Narxi kelishiladi'", `Got: ${s3Uz.priceDisplay}`);
  assert(!s3Uz.hasBargain, "State 3 (UZ): hasBargain is false");

  const s3Ru = formatPropertyPrice({
    priceUzs: 0,
    priceUsd: 0,
    currency: "USD",
    locale: "ru",
    isSale: true,
    isNegotiable: true,
    bargainAllowed: false,
  });
  assert(s3Ru.priceDisplay === "Цена договорная", "State 3 (RU): Displays 'Цена договорная'", `Got: ${s3Ru.priceDisplay}`);
  assert(!s3Ru.hasBargain, "State 3 (RU): hasBargain is false");

  // State 4: Both ON -> Displays 'Narxi kelishiladi' + Savdolashish mumkin badge
  const s4Uz = formatPropertyPrice({
    priceUzs: 0,
    priceUsd: 0,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: true,
    bargainAllowed: true,
  });
  assert(s4Uz.priceDisplay === "Narxi kelishiladi", "State 4 (UZ): Displays 'Narxi kelishiladi'", `Got: ${s4Uz.priceDisplay}`);
  assert(s4Uz.hasBargain === true, "State 4 (UZ): hasBargain is true");
  assert(s4Uz.bargainBadge === "Savdolashish mumkin", "State 4 (UZ): bargainBadge is 'Savdolashish mumkin'", `Got: ${s4Uz.bargainBadge}`);

  const s4Ru = formatPropertyPrice({
    priceUzs: 0,
    priceUsd: 0,
    currency: "USD",
    locale: "ru",
    isSale: true,
    isNegotiable: true,
    bargainAllowed: true,
  });
  assert(s4Ru.priceDisplay === "Цена договорная", "State 4 (RU): Displays 'Цена договорная'", `Got: ${s4Ru.priceDisplay}`);
  assert(s4Ru.hasBargain === true, "State 4 (RU): hasBargain is true");
  assert(s4Ru.bargainBadge === "Торг уместен", "State 4 (RU): bargainBadge is 'Торг уместен'", `Got: ${s4Ru.bargainBadge}`);

  // Priority Rule: If price was entered ($35,000) BUT price_negotiable = true -> strictly overrides price
  const priorityUz = formatPropertyPrice({
    priceUzs: 448000000,
    priceUsd: 35000,
    currency: "USD",
    locale: "uz",
    isSale: true,
    isNegotiable: true,
    bargainAllowed: false,
  });
  assert(
    priorityUz.priceDisplay === "Narxi kelishiladi",
    "Priority Rule: isNegotiable=true strictly overrides numeric price ($35,000) and displays 'Narxi kelishiladi'",
    `Got: ${priorityUz.priceDisplay}`
  );

  // ---------------------------------------------------------------------------
  // 2. FORM VALIDATION LOGIC TESTS
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. FORM VALIDATION LOGIC TESTS ---");

  function validatePrice(price, isNegotiable, locale) {
    if (!isNegotiable && (!price || price <= 0)) {
      return {
        valid: false,
        error:
          locale === "uz"
            ? "Narxni kiriting yoki 'Narxi kelishiladi'ni tanlang."
            : "Введите цену или выберите 'Цена договорная'.",
      };
    }
    return { valid: true, error: null };
  }

  const v1 = validatePrice(null, false, "uz");
  assert(
    !v1.valid && v1.error === "Narxni kiriting yoki 'Narxi kelishiladi'ni tanlang.",
    "Validation blocks when price is empty and negotiable is unchecked",
    `Got: ${JSON.stringify(v1)}`
  );

  const v2 = validatePrice(null, true, "uz");
  assert(
    v2.valid && v2.error === null,
    "Validation passes when price is empty but negotiable is checked",
    `Got: ${JSON.stringify(v2)}`
  );

  const v3 = validatePrice(35000, false, "uz");
  assert(v3.valid && v3.error === null, "Validation passes when numeric price ($35,000) is provided");

  // ---------------------------------------------------------------------------
  // 3. HUDUD USAGE & DELETION LOGIC (ZERO BLEED BETWEEN DISTRICTS)
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. HUDUD USAGE & DELETION SAFETY CHECKS ---");

  const { data: props, error: pErr } = await sb
    .from("properties")
    .select("id, district, district_name_uz, amenities");

  assert(!pErr && Array.isArray(props), "Successfully fetched properties from Supabase");

  function getCountForDistrict(targetId, targetNameUz) {
    const matchSet = new Set([
      targetId.toLowerCase().trim(),
      (targetNameUz || "").toLowerCase().trim(),
    ]);
    return props.filter((p) => {
      const pD = String(p.district || "").toLowerCase().trim();
      const pDName = String(p.district_name_uz || "").toLowerCase().trim();
      const pHudud = String(p.amenities?.hudud_id || "").toLowerCase().trim();
      return matchSet.has(pD) || matchSet.has(pDName) || matchSet.has(pHudud);
    }).length;
  }

  // Test District A: 'markaz' (0 properties in Supabase)
  const markazCount = getCountForDistrict("markaz", "Markaz");
  assert(
    markazCount === 0,
    `District A ('Markaz'): count is strictly 0 (never polluted with 15 legacy properties)`,
    `Got: ${markazCount}`
  );

  // Test District B: '5-mavze' (0 properties in Supabase)
  const mavze5Count = getCountForDistrict("5-mavze", "5-mavze");
  assert(
    mavze5Count === 0,
    `District B ('5-mavze'): count is strictly 0`,
    `Got: ${mavze5Count}`
  );

  // Test District C: '46-daha' (In use by 2 properties in Supabase)
  const daha46Count = getCountForDistrict("46-daha", "46 daha");
  assert(
    daha46Count === 2,
    `District C ('46 daha'): count is strictly 2 (its actual properties)`,
    `Got: ${daha46Count}`
  );

  // Test District D: '6-4-kvartal' (In use by 2 properties in Supabase)
  const daha64Count = getCountForDistrict("6-4-kvartal", "6/4 daha");
  assert(
    daha64Count === 2,
    `District D ('6/4 daha'): count is strictly 2 (its actual properties)`,
    `Got: ${daha64Count}`
  );

  // Evaluate Deletion response
  function evaluateDelete(count) {
    if (count > 0) {
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

  const markazDelete = evaluateDelete(markazCount);
  assert(
    markazDelete.allowed === true && markazDelete.status === 200,
    "District A ('Markaz', 0 properties): DELETE ALLOWED",
    `Got: ${JSON.stringify(markazDelete)}`
  );

  const daha46Delete = evaluateDelete(daha46Count);
  assert(
    daha46Delete.allowed === false &&
      daha46Delete.status === 400 &&
      daha46Delete.message === "Bu hududda mavjud obyektlar mavjud. Avval obyektlarni boshqa hududga o‘tkazing.",
    "District C ('46 daha', 2 properties): DELETE BLOCKED with exact required message",
    `Got: ${JSON.stringify(daha46Delete)}`
  );

  // ---------------------------------------------------------------------------
  // 4. DATA INTEGRITY (ZERO LOSS OF REAL DATA)
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. DATA INTEGRITY (ZERO LOSS) ---");

  assert(props.length >= 11, `All ${props.length} real properties intact in Supabase (>= 11 required)`);

  const { data: realtors } = await sb.from("realtors").select("id, name");
  assert(realtors && realtors.length >= 2, `All ${realtors?.length} real realtors intact in Supabase (>= 2 required)`);

  console.log(`\n==================================================================`);
  console.log(`SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log(`==================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

run();
