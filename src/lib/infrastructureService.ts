import { POICategory, POIItem, InfrastructureSummary } from "./types";

export interface GeoPoint {
  id: string;
  nameUz: string;
  nameRu: string;
  category: POICategory;
  latitude: number;
  longitude: number;
}

// Canonical verified Angren municipal landmarks and infrastructure objects
export const VERIFIED_ANGREN_POIS: GeoPoint[] = [
  // Maktablar
  {
    id: "sch-2",
    nameUz: "2-sonli umumiy o‘rta ta’lim maktabi",
    nameRu: "Средняя школа №2",
    category: "school",
    latitude: 41.0185,
    longitude: 70.142,
  },
  {
    id: "sch-12",
    nameUz: "12-sonli umumta’lim maktabi",
    nameRu: "Общеобразовательная школа №12",
    category: "school",
    latitude: 41.0115,
    longitude: 70.1365,
  },
  {
    id: "sch-17",
    nameUz: "17-sonli umumta’lim maktabi",
    nameRu: "Школа №17",
    category: "school",
    latitude: 41.0232,
    longitude: 70.128,
  },
  {
    id: "sch-35",
    nameUz: "35-sonli ixtisoslashtirilgan maktab",
    nameRu: "Специализированная школа №35",
    category: "school",
    latitude: 41.015,
    longitude: 70.149,
  },

  // Bog'chalar
  {
    id: "kg-14",
    nameUz: "14-sonli davlat maktabgacha ta’lim tashkiloti",
    nameRu: "Государственный детский сад №14",
    category: "kindergarten",
    latitude: 41.0172,
    longitude: 70.1395,
  },
  {
    id: "kg-22",
    nameUz: "22-sonli bolalar bog‘chasi",
    nameRu: "Детский сад №22",
    category: "kindergarten",
    latitude: 41.013,
    longitude: 70.134,
  },

  // Shifoxona va poliklinikalar
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

  // Dorixonalar
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

  // Supermarket va Bozorlar
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
    id: "sup-havas",
    nameUz: "Havas diskounteri",
    nameRu: "Дискаунтер Havas",
    category: "supermarket",
    latitude: 41.021,
    longitude: 70.1335,
  },

  // Jamoat transporti / Bekatlar
  {
    id: "bus-central",
    nameUz: "Markaziy avtobus bekati",
    nameRu: "Центральная автобусная остановка",
    category: "bus_stop",
    latitude: 41.0155,
    longitude: 70.1432,
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
    id: "bus-geolog",
    nameUz: "Geolog bekati",
    nameRu: "Остановка Геолог",
    category: "bus_stop",
    latitude: 41.0085,
    longitude: 70.1545,
  },

  // Parklar
  {
    id: "park-navoiy",
    nameUz: "Alisher Navoiy nomidagi shahar istirohat bog‘i",
    nameRu: "Городской парк им. Алишера Навои",
    category: "park",
    latitude: 41.0138,
    longitude: 70.146,
  },

  // Bankomatlar
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

const CATEGORY_META: Record<
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
};

export function getInfrastructureAround(
  propertyLat: number,
  propertyLng: number,
  maxRadiusMeters: number = 3000,
  locale: "uz" | "ru" = "uz"
): InfrastructureSummary[] {
  if (!propertyLat || !propertyLng) return [];

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
  }).filter((item) => item.distanceMeters <= maxRadiusMeters);

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
      summaries.push({
        category: cat,
        labelUz: meta.labelUz,
        labelRu: meta.labelRu,
        count: list.length,
        closestDistance: list[0].formattedDistance,
        items: list,
      });
    }
  });

  // Sort summaries by closest distance
  return summaries.sort((a, b) => a.items[0].distanceMeters - b.items[0].distanceMeters);
}
