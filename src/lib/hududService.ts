import { HududItem } from "./types";

/**
 * Ray-casting algorithm to determine if a point [lat, lng] is inside a polygon [[lat, lng], ...]
 */
export function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculates the centroid (center lat, lng) of a polygon
 */
export function calculatePolygonCentroid(
  polygon: [number, number][]
): { lat: number; lng: number } {
  if (!polygon || polygon.length === 0) {
    return { lat: 41.0167, lng: 70.1436 }; // Angren center default
  }

  let totalLat = 0;
  let totalLng = 0;
  // Ignore repeating closing point if present
  const points =
    polygon.length > 3 &&
    polygon[0][0] === polygon[polygon.length - 1][0] &&
    polygon[0][1] === polygon[polygon.length - 1][1]
      ? polygon.slice(0, -1)
      : polygon;

  for (const [lat, lng] of points) {
    totalLat += lat;
    totalLng += lng;
  }

  return {
    lat: Number((totalLat / points.length).toFixed(6)),
    lng: Number((totalLng / points.length).toFixed(6)),
  };
}

/**
 * Default Angren canonical hududs with coordinates and bounding polygons
 */
export const DEFAULT_ANGREN_HUDUDS: HududItem[] = [
  {
    id: "markaz",
    city_id: "angren",
    name_uz: "Markaz",
    name_ru: "Центр",
    latitude: 41.0167,
    longitude: 70.1436,
    display_order: 1,
    coordinates: [
      [41.014, 70.14],
      [41.019, 70.14],
      [41.02, 70.148],
      [41.015, 70.148],
      [41.014, 70.14],
    ],
  },
  {
    id: "5-mavze",
    city_id: "angren",
    name_uz: "5-mavze",
    name_ru: "5-массив",
    latitude: 41.0125,
    longitude: 70.138,
    display_order: 2,
    coordinates: [
      [41.01, 70.134],
      [41.015, 70.134],
      [41.015, 70.142],
      [41.01, 70.142],
      [41.01, 70.134],
    ],
  },
  {
    id: "6-mavze",
    city_id: "angren",
    name_uz: "6-mavze",
    name_ru: "6-массив",
    latitude: 41.019,
    longitude: 70.132,
    display_order: 3,
    coordinates: [
      [41.016, 70.128],
      [41.022, 70.128],
      [41.022, 70.136],
      [41.016, 70.136],
      [41.016, 70.128],
    ],
  },
  {
    id: "7-mavze",
    city_id: "angren",
    name_uz: "7-mavze",
    name_ru: "7-массив",
    latitude: 41.024,
    longitude: 70.126,
    display_order: 4,
    coordinates: [
      [41.021, 70.122],
      [41.027, 70.122],
      [41.027, 70.13],
      [41.021, 70.13],
      [41.021, 70.122],
    ],
  },
  {
    id: "dukent",
    city_id: "angren",
    name_uz: "Dukent",
    name_ru: "Дукент",
    latitude: 41.038,
    longitude: 70.175,
    display_order: 5,
    coordinates: [
      [41.032, 70.168],
      [41.044, 70.168],
      [41.044, 70.182],
      [41.032, 70.182],
      [41.032, 70.168],
    ],
  },
  {
    id: "geolog",
    city_id: "angren",
    name_uz: "Geolog",
    name_ru: "Геолог",
    latitude: 41.008,
    longitude: 70.155,
    display_order: 6,
    coordinates: [
      [41.004, 70.15],
      [41.012, 70.15],
      [41.012, 70.16],
      [41.004, 70.16],
      [41.004, 70.15],
    ],
  },
  {
    id: "yangiobod",
    city_id: "angren",
    name_uz: "Yangiobod mavzesi",
    name_ru: "Массив Янгиабад",
    latitude: 41.042,
    longitude: 70.108,
    display_order: 7,
    coordinates: [
      [41.038, 70.1],
      [41.046, 70.1],
      [41.046, 70.116],
      [41.038, 70.116],
      [41.038, 70.1],
    ],
  },
];

/**
 * Finds the matching hudud for a property coordinate if it falls inside any polygon
 */
export function findHududByCoordinate(
  lat: number,
  lng: number,
  hududs: HududItem[]
): HududItem | null {
  for (const h of hududs) {
    if (h.coordinates && h.coordinates.length >= 3) {
      if (isPointInPolygon([lat, lng], h.coordinates)) {
        return h;
      }
    }
  }
  return null;
}
