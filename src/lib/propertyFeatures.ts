import { Property, PropertyType } from "./types";

export type FeatureCategory = "communications" | "extra_objects" | "advantages";

export interface PropertyFeatureItem {
  key: string;
  category: FeatureCategory;
  labelUz: string;
  labelRu: string;
  iconName: string;
  active: boolean;
}

export interface PropertyGroupedFeatures {
  communications: PropertyFeatureItem[];
  extraObjects: PropertyFeatureItem[];
  advantages: PropertyFeatureItem[];
}

export const CATEGORY_TITLES: Record<
  FeatureCategory,
  { uz: string; ru: string }
> = {
  communications: {
    uz: "Kommunikatsiyalar",
    ru: "Коммуникации",
  },
  extra_objects: {
    uz: "Qo‘shimcha obyektlar",
    ru: "Дополнительные объекты",
  },
  advantages: {
    uz: "Afzalliklar",
    ru: "Преимущества",
  },
};

/**
 * Returns category display sequence depending on property type.
 * - Apartment: Communications -> Advantages -> Extra Objects
 * - House/Yard, Land, Commercial, Non-residential: Communications -> Extra Objects -> Advantages
 */
export function getFeatureCategoryOrder(
  propertyType: PropertyType | string | undefined
): FeatureCategory[] {
  if (propertyType === "apartment" || propertyType === "new_build") {
    return ["communications", "advantages", "extra_objects"];
  }
  return ["communications", "extra_objects", "advantages"];
}

/**
 * Extracts and strictly separates all property features, utilities, and amenities
 * into 3 distinct categories with ZERO duplicates.
 */
export function extractPropertyFeatures(
  property: Partial<Property> | null | undefined,
  locale: "uz" | "ru" = "uz"
): PropertyGroupedFeatures {
  const result: PropertyGroupedFeatures = {
    communications: [],
    extraObjects: [],
    advantages: [],
  };

  if (!property) return result;

  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();

  // Canonical alias normalization map
  const CANONICAL_MAP: Record<string, { key: string; category: FeatureCategory; labelUz: string; labelRu: string; iconName: string }> = {
    // Communications
    "gas": { key: "gas", category: "communications", labelUz: "Gaz", labelRu: "Газ", iconName: "Flame" },
    "gaz": { key: "gas", category: "communications", labelUz: "Gaz", labelRu: "Газ", iconName: "Flame" },
    "газ": { key: "gas", category: "communications", labelUz: "Gaz", labelRu: "Газ", iconName: "Flame" },
    "tabiiy gaz": { key: "gas", category: "communications", labelUz: "Gaz", labelRu: "Газ", iconName: "Flame" },

    "electricity": { key: "electricity", category: "communications", labelUz: "Elektr", labelRu: "Электричество", iconName: "Zap" },
    "elektr": { key: "electricity", category: "communications", labelUz: "Elektr", labelRu: "Электричество", iconName: "Zap" },
    "электричество": { key: "electricity", category: "communications", labelUz: "Elektr", labelRu: "Электричество", iconName: "Zap" },
    "svet": { key: "electricity", category: "communications", labelUz: "Elektr", labelRu: "Электричество", iconName: "Zap" },

    "cold_water": { key: "cold_water", category: "communications", labelUz: "Sovuq suv", labelRu: "Холодная вода", iconName: "Droplets" },
    "water": { key: "cold_water", category: "communications", labelUz: "Sovuq suv", labelRu: "Холодная вода", iconName: "Droplets" },
    "sovuq suv": { key: "cold_water", category: "communications", labelUz: "Sovuq suv", labelRu: "Холодная вода", iconName: "Droplets" },
    "ichimlik suvi": { key: "cold_water", category: "communications", labelUz: "Sovuq suv", labelRu: "Холодная вода", iconName: "Droplets" },
    "холодная вода": { key: "cold_water", category: "communications", labelUz: "Sovuq suv", labelRu: "Холодная вода", iconName: "Droplets" },
    "водопровод": { key: "cold_water", category: "communications", labelUz: "Sovuq suv", labelRu: "Холодная вода", iconName: "Droplets" },

    "hot_water": { key: "hot_water", category: "communications", labelUz: "Issiq suv", labelRu: "Горячая вода", iconName: "Thermometer" },
    "issiq suv": { key: "hot_water", category: "communications", labelUz: "Issiq suv", labelRu: "Горячая вода", iconName: "Thermometer" },
    "горячая вода": { key: "hot_water", category: "communications", labelUz: "Issiq suv", labelRu: "Горячая вода", iconName: "Thermometer" },

    "city_heating": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },
    "heating": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },
    "shahar isitish tizimi": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },
    "isitish tizimi": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },
    "otopleniye": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },
    "отопление": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },
    "городское отопление": { key: "city_heating", category: "communications", labelUz: "Shahar isitish tizimi", labelRu: "Городское отопление", iconName: "Flame" },

    "internet": { key: "internet", category: "communications", labelUz: "Internet / Wi-Fi", labelRu: "Интернет / Wi-Fi", iconName: "Wifi" },
    "wi-fi": { key: "internet", category: "communications", labelUz: "Internet / Wi-Fi", labelRu: "Интернет / Wi-Fi", iconName: "Wifi" },
    "wifi": { key: "internet", category: "communications", labelUz: "Internet / Wi-Fi", labelRu: "Интернет / Wi-Fi", iconName: "Wifi" },
    "интернет": { key: "internet", category: "communications", labelUz: "Internet / Wi-Fi", labelRu: "Интернет / Wi-Fi", iconName: "Wifi" },

    // Extra Objects
    "garage": { key: "garage", category: "extra_objects", labelUz: "Garaj", labelRu: "Гараж", iconName: "Warehouse" },
    "garaj": { key: "garage", category: "extra_objects", labelUz: "Garaj", labelRu: "Гараж", iconName: "Warehouse" },
    "гараж": { key: "garage", category: "extra_objects", labelUz: "Garaj", labelRu: "Гараж", iconName: "Warehouse" },

    "green_zone": { key: "green_zone", category: "extra_objects", labelUz: "Yashil hudud", labelRu: "Зелёная зона", iconName: "Trees" },
    "yashil hudud": { key: "green_zone", category: "extra_objects", labelUz: "Yashil hudud", labelRu: "Зелёная зона", iconName: "Trees" },
    "зеленая зона": { key: "green_zone", category: "extra_objects", labelUz: "Yashil hudud", labelRu: "Зелёная зона", iconName: "Trees" },
    "зелёная зона": { key: "green_zone", category: "extra_objects", labelUz: "Yashil hudud", labelRu: "Зелёная зона", iconName: "Trees" },

    "storage": { key: "storage", category: "extra_objects", labelUz: "Ombor", labelRu: "Склад", iconName: "Archive" },
    "ombor": { key: "storage", category: "extra_objects", labelUz: "Ombor", labelRu: "Склад", iconName: "Archive" },
    "omborxona": { key: "storage", category: "extra_objects", labelUz: "Ombor", labelRu: "Склад", iconName: "Archive" },
    "склад": { key: "storage", category: "extra_objects", labelUz: "Ombor", labelRu: "Склад", iconName: "Archive" },
    "кладовая": { key: "storage", category: "extra_objects", labelUz: "Ombor", labelRu: "Склад", iconName: "Archive" },

    "barn": { key: "barn", category: "extra_objects", labelUz: "Molxona", labelRu: "Хлев / хозпостройка", iconName: "Home" },
    "molxona": { key: "barn", category: "extra_objects", labelUz: "Molxona", labelRu: "Хлев / хозпостройка", iconName: "Home" },
    "saroy": { key: "barn", category: "extra_objects", labelUz: "Molxona", labelRu: "Хлев / хозпостройка", iconName: "Home" },
    "хлев": { key: "barn", category: "extra_objects", labelUz: "Molxona", labelRu: "Хлев / хозпостройка", iconName: "Home" },
    "сарай": { key: "barn", category: "extra_objects", labelUz: "Molxona", labelRu: "Хлев / хозпостройка", iconName: "Home" },

    "pool": { key: "pool", category: "extra_objects", labelUz: "Basseyn", labelRu: "Бассейн", iconName: "Waves" },
    "basseyn": { key: "pool", category: "extra_objects", labelUz: "Basseyn", labelRu: "Бассейн", iconName: "Waves" },
    "бассейн": { key: "pool", category: "extra_objects", labelUz: "Basseyn", labelRu: "Бассейн", iconName: "Waves" },

    "extra_building": { key: "extra_building", category: "extra_objects", labelUz: "Qo‘shimcha bino", labelRu: "Дополнительное строение", iconName: "Building" },
    "summer_kitchen": { key: "extra_building", category: "extra_objects", labelUz: "Yozgi oshxona", labelRu: "Летняя кухня", iconName: "Building" },
    "yozgi oshxona": { key: "extra_building", category: "extra_objects", labelUz: "Yozgi oshxona", labelRu: "Летняя кухня", iconName: "Building" },
    "летняя кухня": { key: "extra_building", category: "extra_objects", labelUz: "Yozgi oshxona", labelRu: "Летняя кухня", iconName: "Building" },
    "qo‘shimcha bino": { key: "extra_building", category: "extra_objects", labelUz: "Qo‘shimcha bino", labelRu: "Дополнительное строение", iconName: "Building" },
    "дополнительное строение": { key: "extra_building", category: "extra_objects", labelUz: "Qo‘shimcha bino", labelRu: "Дополнительное строение", iconName: "Building" },

    "garden": { key: "garden", category: "extra_objects", labelUz: "Bog‘", labelRu: "Сад", iconName: "Trees" },
    "bog‘": { key: "garden", category: "extra_objects", labelUz: "Bog‘", labelRu: "Сад", iconName: "Trees" },
    "bog'": { key: "garden", category: "extra_objects", labelUz: "Bog‘", labelRu: "Сад", iconName: "Trees" },
    "сад": { key: "garden", category: "extra_objects", labelUz: "Bog‘", labelRu: "Сад", iconName: "Trees" },

    "balcony": { key: "balcony", category: "extra_objects", labelUz: "Balkon", labelRu: "Балкон", iconName: "DoorClosed" },
    "balkon": { key: "balcony", category: "extra_objects", labelUz: "Balkon", labelRu: "Балкон", iconName: "DoorClosed" },
    "балкон": { key: "balcony", category: "extra_objects", labelUz: "Balkon", labelRu: "Балкон", iconName: "DoorClosed" },

    // Advantages
    "ac": { key: "ac", category: "advantages", labelUz: "Konditsioner", labelRu: "Кондиционер", iconName: "Wind" },
    "konditsioner": { key: "ac", category: "advantages", labelUz: "Konditsioner", labelRu: "Кондиционер", iconName: "Wind" },
    "кондиционер": { key: "ac", category: "advantages", labelUz: "Konditsioner", labelRu: "Кондиционер", iconName: "Wind" },

    "furniture": { key: "furniture", category: "advantages", labelUz: "Mebel", labelRu: "Мебель", iconName: "Armchair" },
    "mebel": { key: "furniture", category: "advantages", labelUz: "Mebel", labelRu: "Мебель", iconName: "Armchair" },
    "мебель": { key: "furniture", category: "advantages", labelUz: "Mebel", labelRu: "Мебель", iconName: "Armchair" },

    "parking": { key: "parking", category: "advantages", labelUz: "Avtoturargoh", labelRu: "Парковка", iconName: "ParkingSquare" },
    "avtoturargoh": { key: "parking", category: "advantages", labelUz: "Avtoturargoh", labelRu: "Парковка", iconName: "ParkingSquare" },
    "парковка": { key: "parking", category: "advantages", labelUz: "Avtoturargoh", labelRu: "Парковка", iconName: "ParkingSquare" },

    "new_renovation": { key: "new_renovation", category: "advantages", labelUz: "Yangi ta’mir", labelRu: "Новый ремонт", iconName: "Sparkles" },
    "yangi ta’mir": { key: "new_renovation", category: "advantages", labelUz: "Yangi ta’mir", labelRu: "Новый ремонт", iconName: "Sparkles" },
    "yangi ta'mir": { key: "new_renovation", category: "advantages", labelUz: "Yangi ta’mir", labelRu: "Новый ремонт", iconName: "Sparkles" },
    "новый ремонт": { key: "new_renovation", category: "advantages", labelUz: "Yangi ta’mir", labelRu: "Новый ремонт", iconName: "Sparkles" },
    "evroremont": { key: "new_renovation", category: "advantages", labelUz: "Yangi ta’mir", labelRu: "Новый ремонт", iconName: "Sparkles" },
    "евроремонт": { key: "new_renovation", category: "advantages", labelUz: "Yangi ta’mir", labelRu: "Новый ремонт", iconName: "Sparkles" },

    "elevator": { key: "elevator", category: "advantages", labelUz: "Lift", labelRu: "Лифт", iconName: "Building" },
    "lift": { key: "elevator", category: "advantages", labelUz: "Lift", labelRu: "Лифт", iconName: "Building" },
    "лифт": { key: "elevator", category: "advantages", labelUz: "Lift", labelRu: "Лифт", iconName: "Building" },
  };

  const addFeature = (
    key: string,
    category: FeatureCategory,
    labelUz: string,
    labelRu: string,
    iconName: string,
    isActive: boolean
  ) => {
    if (!isActive) return;

    const normKey = key.toLowerCase().trim();
    const normUz = labelUz.toLowerCase().trim();
    const normRu = labelRu.toLowerCase().trim();

    // Check if alias maps to a canonical key
    const canonical = CANONICAL_MAP[normKey] || CANONICAL_MAP[normUz] || CANONICAL_MAP[normRu];
    const finalKey = canonical ? canonical.key : normKey;
    const finalCategory = canonical ? canonical.category : category;
    const finalUz = canonical ? canonical.labelUz : labelUz;
    const finalRu = canonical ? canonical.labelRu : labelRu;
    const finalIcon = canonical ? canonical.iconName : iconName;

    if (seenKeys.has(finalKey)) return; // Strictly deduplicate by canonical key
    if (seenLabels.has(finalUz.toLowerCase()) || seenLabels.has(finalRu.toLowerCase())) return; // Deduplicate by label

    seenKeys.add(finalKey);
    seenLabels.add(finalUz.toLowerCase());
    seenLabels.add(finalRu.toLowerCase());

    const item: PropertyFeatureItem = {
      key: finalKey,
      category: finalCategory,
      labelUz: finalUz,
      labelRu: finalRu,
      iconName: finalIcon,
      active: true,
    };

    if (finalCategory === "communications") {
      result.communications.push(item);
    } else if (finalCategory === "extra_objects") {
      result.extraObjects.push(item);
    } else if (finalCategory === "advantages") {
      result.advantages.push(item);
    }
  };

  const utils = (property.utilities as Record<string, any>) || {};
  const am = (property.amenities as Record<string, any>) || {};
  const isLand = property.property_type === "land";

  // =========================================================================
  // 1. COMMUNICATIONS (Kommunikatsiyalar / Коммуникации)
  // =========================================================================
  // Gaz
  const hasGas = Boolean(
    utils.gas ??
    am.gas ??
    !isLand
  );
  addFeature("gas", "communications", "Gaz", "Газ", "Flame", hasGas);

  // Elektr
  const hasElec = Boolean(
    utils.electricity ??
    am.electricity ??
    true
  );
  addFeature("electricity", "communications", "Elektr", "Электричество", "Zap", hasElec);

  // Sovuq suv
  const hasColdWater = Boolean(
    utils.cold_water ??
    utils.water ??
    am.cold_water ??
    am.water ??
    !isLand
  );
  addFeature("cold_water", "communications", "Sovuq suv", "Холодная вода", "Droplets", hasColdWater);

  // Issiq suv
  const hasHotWater = Boolean(
    utils.hot_water ??
    am.hot_water ??
    (property.property_type === "apartment")
  );
  addFeature("hot_water", "communications", "Issiq suv", "Горячая вода", "Thermometer", hasHotWater);

  // Shahar isitish tizimi
  const hasCityHeating = Boolean(
    utils.heating ??
    am.city_heating ??
    am.central_heating ??
    ((property as any).heating_type === "central" || property.property_type === "apartment")
  );
  addFeature("city_heating", "communications", "Shahar isitish tizimi", "Городское отопление", "Flame", hasCityHeating);

  // Internet / Wi-Fi
  const hasInternet = Boolean(
    utils.internet ??
    am.internet ??
    (property as any).internet ??
    !isLand
  );
  addFeature("internet", "communications", "Internet / Wi-Fi", "Интернет / Wi-Fi", "Wifi", hasInternet);

  // =========================================================================
  // 2. EXTRA OBJECTS (Qo‘shimcha obyektlar / Дополнительные объекты)
  // =========================================================================
  // Garaj
  const hasGarage = Boolean(
    am.garage ??
    (property as any).garage ??
    (Array.isArray((am as any).yard_objects) && ((am as any).yard_objects.includes("Garaj") || (am as any).yard_objects.includes("Гараж")))
  );
  addFeature("garage", "extra_objects", "Garaj", "Гараж", "Warehouse", hasGarage);

  // Yashil hudud
  const hasGreenZone = Boolean(
    am.green_zone ??
    (am as any).green_area ??
    (property as any).green_zone ??
    (Array.isArray(am.property_features) && (am.property_features.includes("Yashil hudud") || am.property_features.includes("Зеленая зона")))
  );
  addFeature("green_zone", "extra_objects", "Yashil hudud", "Зелёная зона", "Trees", hasGreenZone);

  // Ombor
  const hasStorage = Boolean(
    am.storage ??
    (am as any).omborxona ??
    (am as any).kladovaya ??
    (Array.isArray((am as any).yard_objects) && ((am as any).yard_objects.includes("Ombor") || (am as any).yard_objects.includes("Кладовая")))
  );
  addFeature("storage", "extra_objects", "Ombor", "Склад", "Archive", hasStorage);

  // Molxona
  const hasBarn = Boolean(
    am.barn ??
    (am as any).saroy ??
    (am as any).molxona ??
    (Array.isArray((am as any).yard_objects) && ((am as any).yard_objects.includes("Molxona") || (am as any).yard_objects.includes("Сарай")))
  );
  addFeature("barn", "extra_objects", "Molxona", "Хлев / хозпостройка", "Home", hasBarn);

  // Basseyn
  const hasPool = Boolean(
    am.pool ??
    (property as any).pool ??
    (Array.isArray((am as any).yard_objects) && ((am as any).yard_objects.includes("Basseyn") || (am as any).yard_objects.includes("Бассейн")))
  );
  addFeature("pool", "extra_objects", "Basseyn", "Бассейн", "Waves", hasPool);

  // Qo‘shimcha bino / Yozgi oshxona
  const hasExtraBuilding = Boolean(
    am.summer_kitchen ??
    (am as any).extra_building ??
    (am as any).additional_building ??
    (Array.isArray((am as any).yard_objects) && ((am as any).yard_objects.includes("Yozgi oshxona") || (am as any).yard_objects.includes("Летняя кухня")))
  );
  addFeature(
    "extra_building",
    "extra_objects",
    am.summer_kitchen ? "Yozgi oshxona" : "Qo‘shimcha bino",
    am.summer_kitchen ? "Летняя кухня" : "Дополнительное строение",
    "Building",
    hasExtraBuilding
  );

  // Bog‘ (Garden)
  const hasGarden = Boolean(
    am.garden ??
    (am as any).bog ??
    (Array.isArray((am as any).yard_objects) && ((am as any).yard_objects.includes("Bog‘") || (am as any).yard_objects.includes("Сад") || (am as any).yard_objects.includes("Bog'")))
  );
  addFeature("garden", "extra_objects", "Bog‘", "Сад", "Trees", hasGarden);

  // Balkon (as a physical extra object on apartment/house)
  const hasBalcony = Boolean(
    am.balcony ??
    (property as any).balcony
  );
  addFeature("balcony", "extra_objects", "Balkon", "Балкон", "DoorClosed", hasBalcony);

  // Custom extra objects stored in amenities.custom_extra_objects
  const customExtra = Array.isArray((am as any).custom_extra_objects)
    ? (am as any).custom_extra_objects
    : [];

  customExtra.forEach((customItem: any, idx: number) => {
    const textUz = typeof customItem === "string" ? customItem : customItem.uz || customItem.nameUz;
    const textRu = typeof customItem === "string" ? customItem : customItem.ru || customItem.nameRu || textUz;
    if (textUz) {
      addFeature(`custom_extra_${idx}_${textUz}`, "extra_objects", textUz, textRu, "Building", true);
    }
  });

  // =========================================================================
  // 3. ADVANTAGES (Afzalliklar / Преимущества)
  // =========================================================================
  // Konditsioner
  const hasAc = Boolean(
    am.ac ??
    (property as any).air_conditioning ??
    (property as any).has_ac
  );
  addFeature("ac", "advantages", "Konditsioner", "Кондиционер", "Wind", hasAc);

  // Mebel
  const hasFurniture = Boolean(
    am.furniture ??
    property.furniture
  );
  addFeature("furniture", "advantages", "Mebel", "Мебель", "Armchair", hasFurniture);

  // Avtoturargoh
  const hasParking = Boolean(
    am.parking ??
    property.parking
  );
  addFeature("parking", "advantages", "Avtoturargoh", "Парковка", "ParkingSquare", hasParking);

  // Yangi ta’mir
  const isNewRenovation = Boolean(
    property.renovation === "euro" ||
    (am as any).new_renovation ||
    (am as any).yangi_tamir
  );
  addFeature("new_renovation", "advantages", "Yangi ta’mir", "Новый ремонт", "Sparkles", isNewRenovation);

  // Lift
  const hasElevator = Boolean(
    am.elevator ??
    (property as any).elevator
  );
  addFeature("elevator", "advantages", "Lift", "Лифт", "Building", hasElevator);

  // Custom advantages stored in amenities.custom_advantages
  const customAdv = Array.isArray((am as any).custom_advantages)
    ? (am as any).custom_advantages
    : [];

  customAdv.forEach((customItem: any, idx: number) => {
    const textUz = typeof customItem === "string" ? customItem : customItem.uz || customItem.nameUz;
    const textRu = typeof customItem === "string" ? customItem : customItem.ru || customItem.nameRu || textUz;
    if (textUz) {
      addFeature(`custom_adv_${idx}_${textUz}`, "advantages", textUz, textRu, "Sparkles", true);
    }
  });

  // Handle legacy property_features, yard_objects, and utilities.custom
  // Route them into the correct category with CANONICAL deduplication!
  const legacyFeatures = [
    ...(Array.isArray(am.property_features) ? am.property_features : []),
    ...(Array.isArray((am as any).yard_objects) ? (am as any).yard_objects : []),
    ...(Array.isArray(utils.custom) ? utils.custom : []),
  ];

  legacyFeatures.forEach((feat, idx) => {
    if (typeof feat !== "string") return;
    const raw = feat.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();

    // The CANONICAL_MAP will intercept garage, yashil hudud, gaz, etc. and discard if already seen!
    if (CANONICAL_MAP[lower]) {
      const c = CANONICAL_MAP[lower];
      addFeature(c.key, c.category, c.labelUz, c.labelRu, c.iconName, true);
      return;
    }

    // Check if it matches extra object keywords
    if (
      lower.includes("garaj") ||
      lower.includes("гараж") ||
      lower.includes("yashil") ||
      lower.includes("зелен") ||
      lower.includes("saroy") ||
      lower.includes("сарай") ||
      lower.includes("ombor") ||
      lower.includes("склад") ||
      lower.includes("basseyn") ||
      lower.includes("бассейн") ||
      lower.includes("oshxona") ||
      lower.includes("кухня") ||
      lower.includes("balkon") ||
      lower.includes("балкон") ||
      lower.includes("bino") ||
      lower.includes("постройк") ||
      lower.includes("uy")
    ) {
      addFeature(`legacy_extra_${idx}_${raw}`, "extra_objects", raw, raw, "Building", true);
    } else if (
      lower.includes("gaz") ||
      lower.includes("газ") ||
      lower.includes("elektr") ||
      lower.includes("электр") ||
      lower.includes("suv") ||
      lower.includes("вод") ||
      lower.includes("isitish") ||
      lower.includes("отоплен") ||
      lower.includes("internet") ||
      lower.includes("интернет")
    ) {
      addFeature(`legacy_comm_${idx}_${raw}`, "communications", raw, raw, "Zap", true);
    } else {
      addFeature(`legacy_adv_${idx}_${raw}`, "advantages", raw, raw, "Sparkles", true);
    }
  });

  return result;
}
