import { extractPropertyFeatures, getFeatureCategoryOrder } from "../src/lib/propertyFeatures";
import type { Property } from "../src/lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log("==================================================");
console.log("TESTING PROPERTY FEATURES / COMMUNICATIONS / EXTRA OBJECTS SEPARATION");
console.log("==================================================\n");

// ----------------------------------------------------
// TEST 1: Category Order by Property Type
// ----------------------------------------------------
console.log("--- TEST 1: Category Order by Property Type ---");
const apartmentOrder = getFeatureCategoryOrder("apartment");
assert(
  JSON.stringify(apartmentOrder) === JSON.stringify(["communications", "advantages", "extra_objects"]),
  "Apartment category order must be: communications -> advantages -> extra_objects"
);

const houseOrder = getFeatureCategoryOrder("house");
assert(
  JSON.stringify(houseOrder) === JSON.stringify(["communications", "extra_objects", "advantages"]),
  "House category order must be: communications -> extra_objects -> advantages"
);

const landOrder = getFeatureCategoryOrder("land");
assert(
  JSON.stringify(landOrder) === JSON.stringify(["communications", "extra_objects", "advantages"]),
  "Land category order must be: communications -> extra_objects -> advantages"
);

const commercialOrder = getFeatureCategoryOrder("commercial");
assert(
  JSON.stringify(commercialOrder) === JSON.stringify(["communications", "extra_objects", "advantages"]),
  "Commercial category order must be: communications -> extra_objects -> advantages"
);

// ----------------------------------------------------
// TEST 2: Strict Deduplication (Garage and Green Zone)
// ----------------------------------------------------
console.log("\n--- TEST 2: Strict Deduplication (Garage and Green Zone) ---");
const mockPropWithDuplicates = {
  id: "test-prop-1",
  title_uz: "Test Hovli",
  title_ru: "Тест Дом",
  property_type: "house",
  utilities: {
    gas: true,
    electricity: true,
    water: true,
    custom: ["Гараж", "Garaj", "Yashil hudud"], // Dirty custom data
  },
  amenities: {
    garage: true,
    green_zone: true,
    property_features: ["Garaj", "Гараж", "Yashil hudud", "Зеленая зона", "Konditsioner"],
    yard_objects: ["Garaj", "Molxona"],
    custom_extra_objects: ["Garaj", "Basseyn"],
    custom_advantages: ["Konditsioner", "Smart Home"],
    ac: true,
  },
} as unknown as Property;

const extracted = extractPropertyFeatures(mockPropWithDuplicates);

// Verify Garage deduplication: must ONLY appear in extraObjects, and exactly ONCE
const garageItems = [
  ...extracted.communications.filter((i) => i.key === "garage" || i.labelUz === "Garaj"),
  ...extracted.extraObjects.filter((i) => i.key === "garage" || i.labelUz === "Garaj"),
  ...extracted.advantages.filter((i) => i.key === "garage" || i.labelUz === "Garaj"),
];
assert(garageItems.length === 1, `Garage must appear exactly ONCE across all categories. Found: ${garageItems.length}`);
assert(extracted.extraObjects.some((i) => i.key === "garage"), "Garage must be categorized under extraObjects");
assert(!extracted.communications.some((i) => i.key === "garage"), "Garage must NOT be in communications");
assert(!extracted.advantages.some((i) => i.key === "garage"), "Garage must NOT be in advantages");

// Verify Yashil hudud deduplication: must ONLY appear in extraObjects, and exactly ONCE
const greenZoneItems = [
  ...extracted.communications.filter((i) => i.key === "green_zone" || i.labelUz === "Yashil hudud"),
  ...extracted.extraObjects.filter((i) => i.key === "green_zone" || i.labelUz === "Yashil hudud"),
  ...extracted.advantages.filter((i) => i.key === "green_zone" || i.labelUz === "Yashil hudud"),
];
assert(greenZoneItems.length === 1, `Yashil hudud must appear exactly ONCE across all categories. Found: ${greenZoneItems.length}`);
assert(extracted.extraObjects.some((i) => i.key === "green_zone"), "Yashil hudud must be categorized under extraObjects");

// Verify Konditsioner deduplication: must ONLY appear in advantages, and exactly ONCE
const acItems = [
  ...extracted.communications.filter((i) => i.key === "ac" || i.labelUz === "Konditsioner"),
  ...extracted.extraObjects.filter((i) => i.key === "ac" || i.labelUz === "Konditsioner"),
  ...extracted.advantages.filter((i) => i.key === "ac" || i.labelUz === "Konditsioner"),
];
assert(acItems.length === 1, `Konditsioner must appear exactly ONCE. Found: ${acItems.length}`);
assert(extracted.advantages.some((i) => i.key === "ac"), "Konditsioner must be categorized under advantages");

// ----------------------------------------------------
// TEST 3: Communications purity
// ----------------------------------------------------
console.log("\n--- TEST 3: Communications purity ---");
const commKeys = extracted.communications.map((i) => i.key);
console.log("Extracted communications keys:", commKeys);
const allowedCommKeys = ["gas", "electricity", "cold_water", "hot_water", "city_heating", "internet"];
const illegalCommKeys = commKeys.filter((k) => !allowedCommKeys.includes(k));
assert(illegalCommKeys.length === 0, `Communications must only contain the 6 allowed keys. Found unexpected: ${illegalCommKeys.join(", ")}`);

// ----------------------------------------------------
// TEST 4: Empty Category Handling
// ----------------------------------------------------
console.log("\n--- TEST 4: Empty Category Handling ---");
const bareProperty = {
  id: "test-prop-bare",
  property_type: "land",
  utilities: {
    gas: false,
    electricity: false,
    cold_water: false,
    internet: false,
  },
  amenities: {},
} as unknown as Property;

const bareExtracted = extractPropertyFeatures(bareProperty);
assert(bareExtracted.extraObjects.length === 0, "Bare property should have empty extraObjects array");
assert(bareExtracted.advantages.length === 0, "Bare property should have empty advantages array");

// ----------------------------------------------------
// TEST 5: Custom Items Classification
// ----------------------------------------------------
console.log("\n--- TEST 5: Custom Items Classification ---");
const propWithCustoms = {
  id: "test-prop-custom",
  property_type: "house",
  utilities: {},
  amenities: {
    custom_extra_objects: ["Qo‘shimcha bino", "Issiqxona"],
    custom_advantages: ["Smart Home", "Quyosh panellari"],
  },
} as unknown as Property;

const customExtracted = extractPropertyFeatures(propWithCustoms);
assert(
  customExtracted.extraObjects.some((i) => i.labelUz === "Qo‘shimcha bino"),
  "custom_extra_objects item 'Qo‘shimcha bino' must be in extraObjects"
);
assert(
  customExtracted.extraObjects.some((i) => i.labelUz === "Issiqxona"),
  "custom_extra_objects item 'Issiqxona' must be in extraObjects"
);
assert(
  customExtracted.advantages.some((i) => i.labelUz === "Smart Home"),
  "custom_advantages item 'Smart Home' must be in advantages"
);
assert(
  customExtracted.advantages.some((i) => i.labelUz === "Quyosh panellari"),
  "custom_advantages item 'Quyosh panellari' must be in advantages"
);

console.log("\n==================================================");
console.log("🎉 ALL PROPERTY FEATURE SEPARATION TESTS PASSED 100%!");
console.log("==================================================");
