import { POICategory, POIItem, InfrastructureSummary } from "./types";

export interface GeoPoint {
  id: string;
  nameUz: string;
  nameRu: string;
  category: POICategory;
  latitude: number;
  longitude: number;
}

// Absolute requirement: Maximum search radius is strictly 1000 meters (1 km)
export const MAX_INFRASTRUCTURE_RADIUS_METERS = 1000;

// Canonical verified Angren municipal landmarks and infrastructure objects
export const VERIFIED_ANGREN_POIS: GeoPoint[] = [
  // ----------------------------------------------------
  // Markaz (Markaziy hudud)
  // ----------------------------------------------------
  {
    id: "sch-2",
    nameUz: "2-sonli umumiy o‘rta ta’lim maktabi",
    nameRu: "Средняя школа №2",
    category: "school",
    latitude: 41.0185,
    longitude: 70.142,
  },
  {
    id: "sch-35",
    nameUz: "35-sonli ixtisoslashtirilgan maktab",
    nameRu: "Специализированная школа №35",
    category: "school",
    latitude: 41.015,
    longitude: 70.149,
  },
  {
    id: "kg-14",
    nameUz: "14-sonli davlat maktabgacha ta’lim tashkiloti",
    nameRu: "Государственный детский сад №14",
    category: "kindergarten",
    latitude: 41.0172,
    longitude: 70.1395,
  },
  {
    id: "hosp-tmo",
    nameUz: "Angren shahar Markaziy shifoxonasi (TMO)",
    nameRu: "Центральная городская больница (ТМО)",
    category: "hospital",
    latitude: 41.0195,
    longitude: 70.151,
  },
  {
    id: "hosp-poly1",
    nameUz: "1-sonli shahar oilaviy poliklinikasi",
    nameRu: "Городская семейная поликлиника №1",
    category: "hospital",
    latitude: 41.0142,
    longitude: 70.1412,
  },
  {
    id: "pharm-grand",
    nameUz: "Grand Pharm dorixonasi (24/7)",
    nameRu: "Аптека Grand Pharm (круглосуточно)",
    category: "pharmacy",
    latitude: 41.0162,
    longitude: 70.1428,
  },
  {
    id: "pharm-oxymed",
    nameUz: "OXYmed dorixonasi",
    nameRu: "Аптека OXYmed",
    category: "pharmacy",
    latitude: 41.0135,
    longitude: 70.1388,
  },
  {
    id: "mkt-central",
    nameUz: "Angren Dehqon bozori (Markaziy bozor)",
    nameRu: "Дехканский базар Ангрена (Центральный)",
    category: "supermarket",
    latitude: 41.0148,
    longitude: 70.1442,
  },
  {
    id: "sup-korzinka",
    nameUz: "Korzinka Angren supermarketi",
    nameRu: "Супермаркет Korzinka Ангрен",
    category: "supermarket",
    latitude: 41.0175,
    longitude: 70.1408,
  },
  {
    id: "bus-central",
    nameUz: "Markaziy avtobus bekati",
    nameRu: "Центральная автобусная остановка",
    category: "bus_stop",
    latitude: 41.0155,
    longitude: 70.1432,
  },
  {
    id: "park-navoiy",
    nameUz: "Alisher Navoiy nomidagi shahar istirohat bog‘i",
    nameRu: "Городской парк им. Алишера Навои",
    category: "park",
    latitude: 41.0138,
    longitude: 70.146,
  },
  {
    id: "atm-xalq",
    nameUz: "Xalq Banki 24/7 Bankomati",
    nameRu: "Банкомат Народного Банка (24/7)",
    category: "atm",
    latitude: 41.016,
    longitude: 70.1418,
  },
  {
    id: "atm-agro",
    nameUz: "Agrobank bankomati",
    nameRu: "Банкомат Агробанка",
    category: "atm",
    latitude: 41.0145,
    longitude: 70.1435,
  },
  {
    id: "bank-nbu",
    nameUz: "O‘zmilliybank (NBU) filiali",
    nameRu: "Филиал Узнацбанка (NBU)",
    category: "bank",
    latitude: 41.0158,
    longitude: 70.1422,
  },
  {
    id: "edu-registan",
    nameUz: "Registon o‘quv markazi",
    nameRu: "Учебный центр Регистан",
    category: "education",
    latitude: 41.0165,
    longitude: 70.1425,
  },
  {
    id: "rest-chinor",
    nameUz: "Chinor milliy taomlar restorani",
    nameRu: "Ресторан национальной кухни Чинор",
    category: "restaurant",
    latitude: 41.0163,
    longitude: 70.143,
  },

  // ----------------------------------------------------
  // 6-mavze (6-й микрорайон) — Test Property 1 Area
  // ----------------------------------------------------
  {
    id: "sch-17",
    nameUz: "17-sonli umumta’lim maktabi",
    nameRu: "Школа №17 (6-й микрорайон)",
    category: "school",
    latitude: 41.0196,
    longitude: 70.1315,
  },
  {
    id: "kg-22",
    nameUz: "22-sonli bolalar bog‘chasi",
    nameRu: "Детский сад №22 (6-й микрорайон)",
    category: "kindergarten",
    latitude: 41.0188,
    longitude: 70.1332,
  },
  {
    id: "pharm-mavze6",
    nameUz: "6-mavze dorixonasi (24/7)",
    nameRu: "Аптека 6-й микрорайон (24/7)",
    category: "pharmacy",
    latitude: 41.0192,
    longitude: 70.1324,
  },
  {
    id: "sup-havas",
    nameUz: "Havas diskounteri (6-mavze)",
    nameRu: "Дискаунтер Havas (6-й микрорайон)",
    category: "supermarket",
    latitude: 41.0201,
    longitude: 70.133,
  },
  {
    id: "bus-mavze6",
    nameUz: "6-mavze avtobus bekati",
    nameRu: "Остановка 6-й микрорайон",
    category: "bus_stop",
    latitude: 41.0192,
    longitude: 70.1325,
  },
  {
    id: "atm-mavze6",
    nameUz: "Xalq Banki 24/7 Bankomati (6-mavze)",
    nameRu: "Банкомат Халк Банка (6-й микрорайон)",
    category: "atm",
    latitude: 41.0189,
    longitude: 70.1328,
  },

  // ----------------------------------------------------
  // Dukent (Дукент) — Test Property 2 Area
  // ----------------------------------------------------
  {
    id: "sch-dukent24",
    nameUz: "24-sonli umumta’lim maktabi (Dukent)",
    nameRu: "Школа №24 (Дукент)",
    category: "school",
    latitude: 41.0375,
    longitude: 70.174,
  },
  {
    id: "kg-dukent8",
    nameUz: "8-sonli bolalar bog‘chasi (Dukent)",
    nameRu: "Детский сад №8 (Дукент)",
    category: "kindergarten",
    latitude: 41.0385,
    longitude: 70.176,
  },
  {
    id: "hosp-dukent",
    nameUz: "Dukent qishloq vrachlik punkti (QVP)",
    nameRu: "Дукентский сельский врачебный пункт (СВП)",
    category: "hospital",
    latitude: 41.0372,
    longitude: 70.1745,
  },
  {
    id: "pharm-dukent",
    nameUz: "Dukent markaziy dorixonasi",
    nameRu: "Центральная аптека Дукент",
    category: "pharmacy",
    latitude: 41.0382,
    longitude: 70.1755,
  },
  {
    id: "sup-dukent",
    nameUz: "Dukent oziq-ovqat supermarketi",
    nameRu: "Продуктовый супермаркет Дукент",
    category: "supermarket",
    latitude: 41.0378,
    longitude: 70.1752,
  },
  {
    id: "bus-dukent",
    nameUz: "Dukent markaziy avtobus bekati",
    nameRu: "Центральная остановка Дукент",
    category: "bus_stop",
    latitude: 41.038,
    longitude: 70.1746,
  },
  {
    id: "park-dukent",
    nameUz: "Dukent madaniyat va istirohat bog‘i",
    nameRu: "Парк культуры и отдыха Дукент",
    category: "park",
    latitude: 41.0389,
    longitude: 70.1762,
  },

  // ----------------------------------------------------
  // 5-mavze (5-й микрорайон)
  // ----------------------------------------------------
  {
    id: "sch-12",
    nameUz: "12-sonli umumta’lim maktabi",
    nameRu: "Общеобразовательная школа №12 (5-mavze)",
    category: "school",
    latitude: 41.0115,
    longitude: 70.1365,
  },
  {
    id: "kg-5m",
    nameUz: "5-mavze bolalar bog‘chasi",
    nameRu: "Детский сад 5-й микрорайон",
    category: "kindergarten",
    latitude: 41.012,
    longitude: 70.1375,
  },
  {
    id: "pharm-5m",
    nameUz: "5-mavze dorixonasi",
    nameRu: "Аптека 5-й микрорайон",
    category: "pharmacy",
    latitude: 41.0122,
    longitude: 70.1382,
  },

  // ----------------------------------------------------
  // Geolog
  // ----------------------------------------------------
  {
    id: "bus-geolog",
    nameUz: "Geolog bekati",
    nameRu: "Остановка Геолог",
    category: "bus_stop",
    latitude: 41.0085,
    longitude: 70.1545,
  },
  {
    id: "pharm-geolog",
    nameUz: "Geolog dorixonasi",
    nameRu: "Аптека Геолог",
    category: "pharmacy",
    latitude: 41.0082,
    longitude: 70.155,
  },
];

// Haversine exact geodesic distance calculation in meters
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(meters: number, locale: "uz" | "ru"): string {
  if (meters < 1000) {
    return `${meters} ${locale === "uz" ? "m" : "м"}`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} ${locale === "uz" ? "km" : "км"}`;
}

export const CATEGORY_META: Record<
  POICategory,
  { labelUz: string; labelRu: string; singleUz: string; singleRu: string }
> = {
  school: {
    labelUz: "Maktablar",
    labelRu: "Школы",
    singleUz: "maktab",
    singleRu: "школа",
  },
  kindergarten: {
    labelUz: "Bog‘chalar",
    labelRu: "Детсады",
    singleUz: "bog‘cha",
    singleRu: "детсад",
  },
  pharmacy: {
    labelUz: "Dorixonalar",
    labelRu: "Аптеки",
    singleUz: "dorixona",
    singleRu: "аптека",
  },
  supermarket: {
    labelUz: "Bozor va do‘konlar",
    labelRu: "Магазины и рынки",
    singleUz: "do‘kon/bozor",
    singleRu: "магазин/рынок",
  },
  park: {
    labelUz: "Park va xiyobonlar",
    labelRu: "Парки и скверы",
    singleUz: "park",
    singleRu: "парк",
  },
  bus_stop: {
    labelUz: "Avtobus bekatlari",
    labelRu: "Автобусные остановки",
    singleUz: "bekat",
    singleRu: "остановка",
  },
  hospital: {
    labelUz: "Tibbiyot maskanlari",
    labelRu: "Медицина",
    singleUz: "shifoxona/poliklinika",
    singleRu: "больница/поликлиника",
  },
  atm: {
    labelUz: "Bankomatlar",
    labelRu: "Банкоматы",
    singleUz: "bankomat",
    singleRu: "банкомат",
  },
  bank: {
    labelUz: "Banklar",
    labelRu: "Банки",
    singleUz: "bank",
    singleRu: "банк",
  },
  education: {
    labelUz: "O‘quv markazlari",
    labelRu: "Учебные центры",
    singleUz: "o‘quv markazi",
    singleRu: "учебный центр",
  },
  restaurant: {
    labelUz: "Kafe va restoranlar",
    labelRu: "Кафе и рестораны",
    singleUz: "kafe/restoran",
    singleRu: "кафе/ресторан",
  },
  gas_station: {
    labelUz: "Yoqilg‘i quyish (Zapravka)",
    labelRu: "Автозаправки (АЗС)",
    singleUz: "zapravka",
    singleRu: "АЗС",
  },
  sport: {
    labelUz: "Sport maydoni va zallari",
    labelRu: "Спортивные объекты",
    singleUz: "sport majmuasi",
    singleRu: "спортплощадка",
  },
  police: {
    labelUz: "Ichki ishlar / Xavfsizlik",
    labelRu: "Правопорядок / Охрана",
    singleUz: "xavfsizlik maskani",
    singleRu: "пункт охраны",
  },
  other: {
    labelUz: "Boshqa jamoat obyektlari",
    labelRu: "Другие общественные объекты",
    singleUz: "jamoat obyekti",
    singleRu: "общественный объект",
  },
};

/**
 * Calculates nearby verified infrastructure around property coordinates.
 * STRICT REQUIREMENT: Radius NEVER exceeds 1000 meters.
 */
export function getInfrastructureAround(
  propertyLat: number,
  propertyLng: number,
  maxRadiusMeters: number = MAX_INFRASTRUCTURE_RADIUS_METERS,
  locale: "uz" | "ru" = "uz"
): InfrastructureSummary[] {
  if (!propertyLat || !propertyLng) return [];

  // INTERNAL HARD ENFORCEMENT: Never exceed MAX_INFRASTRUCTURE_RADIUS_METERS (1000m)
  const effectiveRadius = Math.min(
    typeof maxRadiusMeters === "number" && maxRadiusMeters > 0
      ? maxRadiusMeters
      : MAX_INFRASTRUCTURE_RADIUS_METERS,
    MAX_INFRASTRUCTURE_RADIUS_METERS
  );

  const itemsWithDistance: POIItem[] = VERIFIED_ANGREN_POIS.map((poi) => {
    const dist = calculateHaversineDistanceMeters(
      propertyLat,
      propertyLng,
      poi.latitude,
      poi.longitude
    );
    return {
      id: poi.id,
      nameUz: poi.nameUz,
      nameRu: poi.nameRu,
      category: poi.category,
      latitude: poi.latitude,
      longitude: poi.longitude,
      distanceMeters: dist,
      formattedDistance: formatDistance(dist, locale),
    };
  }).filter((item) => item.distanceMeters <= effectiveRadius);

  // Group by category
  const groups: Partial<Record<POICategory, POIItem[]>> = {};
  itemsWithDistance.forEach((item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category]!.push(item);
  });

  const summaries: InfrastructureSummary[] = [];

  (Object.keys(groups) as POICategory[]).forEach((cat) => {
    const list = groups[cat]!.sort((a, b) => a.distanceMeters - b.distanceMeters);
    if (list.length > 0) {
      const meta = CATEGORY_META[cat];
      if (meta) {
        summaries.push({
          category: cat,
          labelUz: meta.labelUz,
          labelRu: meta.labelRu,
          count: list.length,
          closestDistance: list[0].formattedDistance,
          items: list,
        });
      }
    }
  });

  // Sort summaries by closest distance
  return summaries.sort((a, b) => a.items[0].distanceMeters - b.items[0].distanceMeters);
}

export const OVERPASS_ENDPOINTS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export function mapOSMElementToCategory(tags: Record<string, string>): {
  category: POICategory;
  defaultNameUz: string;
  defaultNameRu: string;
} {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const highway = (tags.highway || "").toLowerCase();
  const healthcare = (tags.healthcare || "").toLowerCase();
  const publicTransport = (tags.public_transport || "").toLowerCase();

  if (amenity === "school" || amenity === "university") {
    return {
      category: "school",
      defaultNameUz: "Maktab",
      defaultNameRu: "Школа",
    };
  }
  if (amenity === "kindergarten") {
    return {
      category: "kindergarten",
      defaultNameUz: "Bolalar bog‘chasi",
      defaultNameRu: "Детский сад",
    };
  }
  if (amenity === "pharmacy" || shop === "chemist" || healthcare === "pharmacy") {
    return {
      category: "pharmacy",
      defaultNameUz: "Dorixona",
      defaultNameRu: "Аптека",
    };
  }
  if (
    amenity === "hospital" ||
    amenity === "clinic" ||
    amenity === "doctors" ||
    amenity === "dentist" ||
    healthcare === "hospital" ||
    healthcare === "clinic"
  ) {
    return {
      category: "hospital",
      defaultNameUz: "Tibbiyot maskani",
      defaultNameRu: "Медицинское учреждение",
    };
  }
  if (
    shop === "supermarket" ||
    shop === "convenience" ||
    shop === "general" ||
    shop === "grocery" ||
    shop === "department_store" ||
    shop === "mall" ||
    shop === "bakery" ||
    shop === "butcher" ||
    amenity === "marketplace"
  ) {
    return {
      category: "supermarket",
      defaultNameUz: "Supermarket / Do‘kon",
      defaultNameRu: "Супермаркет / Магазин",
    };
  }
  if (
    highway === "bus_stop" ||
    amenity === "bus_station" ||
    publicTransport === "platform" ||
    publicTransport === "stop_position"
  ) {
    return {
      category: "bus_stop",
      defaultNameUz: "Avtobus bekati",
      defaultNameRu: "Автобусная остановка",
    };
  }
  if (leisure === "park" || leisure === "garden" || leisure === "playground") {
    return {
      category: "park",
      defaultNameUz: "Park / Xiyobon",
      defaultNameRu: "Парк / Сквер",
    };
  }
  if (amenity === "atm") {
    return {
      category: "atm",
      defaultNameUz: "Bankomat (24/7)",
      defaultNameRu: "Банкомат",
    };
  }
  if (amenity === "bank") {
    return {
      category: "bank",
      defaultNameUz: "Bank",
      defaultNameRu: "Банк",
    };
  }
  if (
    amenity === "college" ||
    amenity === "language_school" ||
    amenity === "music_school" ||
    amenity === "training_centre"
  ) {
    return {
      category: "education",
      defaultNameUz: "O‘quv markazi / Kollej",
      defaultNameRu: "Учебный центр / Колледж",
    };
  }
  if (amenity === "cafe" || amenity === "restaurant" || amenity === "fast_food") {
    return {
      category: "restaurant",
      defaultNameUz: "Kafe / Restoran",
      defaultNameRu: "Кафе / Ресторан",
    };
  }
  if (amenity === "fuel") {
    return {
      category: "gas_station",
      defaultNameUz: "Yoqilg‘i quyish (Zapravka)",
      defaultNameRu: "Автозаправка (АЗС)",
    };
  }
  if (
    leisure === "sports_centre" ||
    leisure === "stadium" ||
    leisure === "pitch" ||
    leisure === "fitness_centre"
  ) {
    return {
      category: "sport",
      defaultNameUz: "Sport majmuasi",
      defaultNameRu: "Спортивный комплекс",
    };
  }
  if (amenity === "police") {
    return {
      category: "police",
      defaultNameUz: "Ichki ishlar / IIB maskani",
      defaultNameRu: "Пункт правопорядка",
    };
  }
  return {
    category: "other",
    defaultNameUz: "Jamoat obyekti",
    defaultNameRu: "Общественный объект",
  };
}

/**
 * Fetches real nearby infrastructure using OpenStreetMap / Overpass API
 * with fast spatial bbox filtering, multiple public endpoints, and strict 1km distance check.
 */
export async function fetchNearbyPOIsFromOverpass(
  propertyLat: number,
  propertyLng: number,
  locale: "uz" | "ru" = "uz"
): Promise<{
  summaries: InfrastructureSummary[];
  totalCount: number;
} | null> {
  const minLat = (propertyLat - 0.0095).toFixed(6);
  const maxLat = (propertyLat + 0.0095).toFixed(6);
  const minLng = (propertyLng - 0.013).toFixed(6);
  const maxLng = (propertyLng + 0.013).toFixed(6);

  const query = `[out:json][timeout:10];
(
  node(${minLat},${minLng},${maxLat},${maxLng})["amenity"];
  node(${minLat},${minLng},${maxLat},${maxLng})["shop"];
  node(${minLat},${minLng},${maxLat},${maxLng})["leisure"];
  node(${minLat},${minLng},${maxLat},${maxLng})["highway"="bus_stop"];
  way(${minLat},${minLng},${maxLat},${maxLng})["amenity"];
  way(${minLat},${minLng},${maxLat},${maxLng})["shop"];
  way(${minLat},${minLng},${maxLat},${maxLng})["leisure"];
);
out center 60;`;

  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "AngrenEstate/1.0 (contact@angren-estate.uz; https://angren-estate.uz)",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !Array.isArray(data.elements)) continue;

      const itemsWithDistance: POIItem[] = [];
      const seenIds = new Set<string>();
      const seenPositions: Array<{ lat: number; lng: number; name: string }> = [];

      for (const el of data.elements) {
        const pLat = el.lat ?? el.center?.lat;
        const pLng = el.lon ?? el.center?.lon;
        if (pLat == null || pLng == null) continue;

        // Strict Haversine distance calculation
        const dist = calculateHaversineDistanceMeters(propertyLat, propertyLng, pLat, pLng);

        // HARD RULE: Never display if distance > 1000m
        if (dist > MAX_INFRASTRUCTURE_RADIUS_METERS) continue;

        const tags: Record<string, string> = el.tags || {};
        const { category, defaultNameUz, defaultNameRu } = mapOSMElementToCategory(tags);

        const rawName = tags.name || tags["name:uz"] || tags["name:ru"] || tags["name:en"];
        const nameUz = rawName || defaultNameUz;
        const nameRu = tags["name:ru"] || rawName || defaultNameRu;

        const id = `osm_${el.type || "node"}_${el.id}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        // Proximity deduplication (within 40m with same normalized name)
        const normName = (rawName || category).toLowerCase().trim();
        const isDuplicateNear = seenPositions.some((pos) => {
          if (pos.name === normName) {
            const d = calculateHaversineDistanceMeters(pLat, pLng, pos.lat, pos.lng);
            return d < 40;
          }
          return false;
        });
        if (isDuplicateNear) continue;
        seenPositions.push({ lat: pLat, lng: pLng, name: normName });

        itemsWithDistance.push({
          id,
          nameUz,
          nameRu,
          category,
          latitude: pLat,
          longitude: pLng,
          distanceMeters: dist,
          formattedDistance: formatDistance(dist, locale),
          source: "OpenStreetMap",
        });
      }

      if (itemsWithDistance.length > 0) {
        // Group by category
        const groups: Partial<Record<POICategory, POIItem[]>> = {};
        itemsWithDistance.forEach((item) => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category]!.push(item);
        });

        const summaries: InfrastructureSummary[] = [];
        (Object.keys(groups) as POICategory[]).forEach((cat) => {
          const list = groups[cat]!.sort((a, b) => a.distanceMeters - b.distanceMeters);
          if (list.length > 0) {
            const meta = CATEGORY_META[cat];
            if (meta) {
              summaries.push({
                category: cat,
                labelUz: meta.labelUz,
                labelRu: meta.labelRu,
                count: list.length,
                closestDistance: list[0].formattedDistance,
                items: list,
              });
            }
          }
        });

        summaries.sort((a, b) => a.items[0].distanceMeters - b.items[0].distanceMeters);

        return {
          summaries,
          totalCount: itemsWithDistance.length,
        };
      }
    } catch (err) {
      console.warn(`[Overpass] Endpoint ${ep} failed, trying next fallback:`, err);
    }
  }

  return null;
}

/**
 * Asynchronously fetches nearby infrastructure from the server API endpoint
 * using OpenStreetMap / Overpass API, server-side caching, and strict 1km filtering.
 */
export async function fetchNearbyInfrastructure(
  propertyLat: number,
  propertyLng: number,
  locale: "uz" | "ru" = "uz"
): Promise<{
  source: "OpenStreetMap" | "verified_fallback";
  summaries: InfrastructureSummary[];
  totalCount: number;
  message?: string;
}> {
  if (!propertyLat || !propertyLng) {
    return {
      source: "verified_fallback",
      summaries: [],
      totalCount: 0,
      message:
        locale === "uz"
          ? "1 km radiusda infratuzilma topilmadi."
          : "В радиусе 1 км инфраструктура не найдена.",
    };
  }

  try {
    const res = await fetch(
      `/api/infrastructure/nearby?lat=${propertyLat}&lng=${propertyLng}&locale=${locale}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.summaries)) {
        return {
          source: data.source || "OpenStreetMap",
          summaries: data.summaries,
          totalCount:
            typeof data.totalCount === "number"
              ? data.totalCount
              : data.summaries.reduce((a: number, s: any) => a + s.count, 0),
          message: data.message,
        };
      }
    }
  } catch (err) {
    console.warn("[infrastructureService] fetchNearbyInfrastructure error, falling back locally:", err);
  }

  const localSummaries = getInfrastructureAround(
    propertyLat,
    propertyLng,
    MAX_INFRASTRUCTURE_RADIUS_METERS,
    locale
  );
  const totalCount = localSummaries.reduce((acc, s) => acc + s.count, 0);

  return {
    source: "verified_fallback",
    summaries: localSummaries,
    totalCount,
    message:
      totalCount === 0
        ? locale === "uz"
          ? "1 km radiusda infratuzilma topilmadi."
          : "В радиусе 1 км инфраструктура не найдена."
        : undefined,
  };
}
