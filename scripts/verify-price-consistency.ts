import { formatPrice, formatPropertyPrice, uzsToUsd, USD_EXCHANGE_RATE } from "../src/lib/currency";

console.log("=== RUNNING PRICE CONSISTENCY VERIFICATION ===");

// Test 1: The exact production property that had the bug
const testProp1 = {
  id: "prop-1789932668680",
  price_usd: 37500,
  price_uzs: 443984625,
  isSale: true,
};

// Test with live fluctuating exchange rates (e.g. 11802.19, 12850, 13000)
const ratesToTest = [11802.19, 12800, 12850, 13100];

for (const rate of ratesToTest) {
  const formattedUsd = formatPropertyPrice({
    priceUzs: testProp1.price_uzs,
    priceUsd: testProp1.price_usd,
    currency: "USD",
    locale: "ru",
    isSale: true,
    exchangeRate: rate,
  });

  const formattedUz = formatPropertyPrice({
    priceUzs: testProp1.price_uzs,
    priceUsd: testProp1.price_usd,
    currency: "USD",
    locale: "uz",
    isSale: true,
    exchangeRate: rate,
  });

  const formattedUzsMode = formatPropertyPrice({
    priceUzs: testProp1.price_uzs,
    priceUsd: testProp1.price_usd,
    currency: "UZS",
    locale: "uz",
    isSale: true,
    exchangeRate: rate,
  });

  console.log(`Rate ${rate}:`);
  console.log(`  USD display (ru): ${formattedUsd.priceDisplay}`);
  console.log(`  USD secondary (ru): ${formattedUsd.secondaryPrice}`);
  console.log(`  USD display (uz): ${formattedUz.priceDisplay}`);
  console.log(`  UZS mode display: ${formattedUzsMode.priceDisplay}`);
  console.log(`  UZS mode secondary: ${formattedUzsMode.secondaryPrice}`);

  if (formattedUsd.priceDisplay !== "$37,500") {
    console.error(`FAIL: Expected $37,500 but got ${formattedUsd.priceDisplay}`);
    process.exit(1);
  }

  if (formattedUz.priceDisplay !== "$37,500") {
    console.error(`FAIL: Expected $37,500 but got ${formattedUz.priceDisplay}`);
    process.exit(1);
  }

  if (formattedUzsMode.secondaryPrice !== "≈ $37,500") {
    console.error(`FAIL: Expected ≈ $37,500 but got ${formattedUzsMode.secondaryPrice}`);
    process.exit(1);
  }
}

// Test 2: Other prices requested by user ($30,000, $50,000, $12,500)
const testCases = [
  { price_usd: 30000, price_uzs: 384000000, expected: "$30,000" },
  { price_usd: 50000, price_uzs: 640000000, expected: "$50,000" },
  { price_usd: 12500, price_uzs: 160000000, expected: "$12,500" },
];

for (const tc of testCases) {
  const res = formatPropertyPrice({
    priceUzs: tc.price_uzs,
    priceUsd: tc.price_usd,
    currency: "USD",
    locale: "ru",
    isSale: true,
    exchangeRate: 11802.19, // Even with fluctuating rate, exact USD must remain untouched
  });

  console.log(`USD ${tc.price_usd} -> ${res.priceDisplay}`);
  if (res.priceDisplay !== tc.expected) {
    console.error(`FAIL: Expected ${tc.expected} but got ${res.priceDisplay}`);
    process.exit(1);
  }
}

// Test 3: Rent property
const rentProp = formatPropertyPrice({
  priceUzs: 5000000,
  priceUsd: 400,
  currency: "USD",
  locale: "uz",
  isSale: false,
  exchangeRate: 12800,
});
console.log(`Rent USD (uz): ${rentProp.priceDisplay}`);
if (rentProp.priceDisplay !== "$400 / oy") {
  console.error(`FAIL: Expected "$400 / oy" but got ${rentProp.priceDisplay}`);
  process.exit(1);
}

// Test 4: formatPrice with exactPriceUsd
const legacyFormatted = formatPrice(
  testProp1.price_uzs,
  "ru",
  "USD",
  false,
  11802.19,
  testProp1.price_usd
);
console.log(`Legacy formatPrice with exactPriceUsd: primary=${legacyFormatted.primary}, secondary=${legacyFormatted.secondary}`);
if (legacyFormatted.primary !== "$37,500") {
  console.error(`FAIL: Expected $37,500 but got ${legacyFormatted.primary}`);
  process.exit(1);
}

// Test 5: formatPrice fallback when exactPriceUsd is missing
const fallback = formatPrice(12800000, "uz", "USD", false, 12800);
console.log(`Fallback formatPrice: primary=${fallback.primary}`);
if (fallback.primary !== "$1,000") {
  console.error(`FAIL: Expected $1,000 but got ${fallback.primary}`);
  process.exit(1);
}

console.log("=== ALL PRICE CONSISTENCY TESTS PASSED SUCCESSFULLY! ===");
