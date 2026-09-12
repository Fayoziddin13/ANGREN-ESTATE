"use client";

import { useSyncExternalStore, useCallback } from "react";

export type MapMode = "standard" | "satellite";

export interface MapCameraState {
  center: [number, number];
  zoom: number;
}

const MAP_MODE_KEY = "angren_map_style_v1";
const MAP_CAMERA_KEY = "angren_map_camera_v1";
const MAP_MODE_EVENT = "angren_map_mode_change";

// Angren urban residential center (5-, 6-, 7-mavze and Central districts)
export const DEFAULT_ANGREN_CENTER: [number, number] = [41.0185, 70.1340];
export const DEFAULT_MAP_ZOOM = 13.8;

// Angren City geographic navigation boundaries [South-West [lat, lng], North-East [lat, lng]]
export const ANGREN_RESTRICT_BOUNDS: [[number, number], [number, number]] = [
  [40.9650, 70.0400], // Southwest: Qorabog', A373 gateway, southern riverbank
  [41.0700, 70.2200], // Northeast: Dukent, northern foothills, eastern districts
];

export const ANGREN_MIN_ZOOM = 12.2;
export const ANGREN_MAX_ZOOM = 18.5;

export function normalizeCameraCenter(c: [number, number]): [number, number] {
  if (!Array.isArray(c) || c.length < 2) return DEFAULT_ANGREN_CENTER;
  // If first coordinate is longitude (~70.1) and second is latitude (~41.0), normalize to [lat, lng]
  if (c[0] > 60 && c[1] < 50) {
    return [c[1], c[0]];
  }
  return [c[0], c[1]];
}

let inMemoryMode: MapMode = "satellite";
let inMemoryCamera: MapCameraState = {
  center: DEFAULT_ANGREN_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
};

// Client initialization
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem(MAP_MODE_KEY);
    if (saved === "standard" || saved === "satellite") {
      inMemoryMode = saved;
    }
    const savedCam = sessionStorage.getItem(MAP_CAMERA_KEY);
    if (savedCam) {
      const parsed = JSON.parse(savedCam);
      if (Array.isArray(parsed.center) && typeof parsed.zoom === "number") {
        inMemoryCamera = {
          center: normalizeCameraCenter(parsed.center),
          zoom: parsed.zoom,
        };
      }
    }
  } catch {}
}

export function getStoredMapMode(): MapMode {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(MAP_MODE_KEY);
      if (saved === "standard" || saved === "satellite") {
        inMemoryMode = saved;
        return saved;
      }
    } catch {}
  }
  return inMemoryMode;
}

export function setStoredMapMode(mode: MapMode): void {
  inMemoryMode = mode;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MAP_MODE_KEY, mode);
      window.dispatchEvent(new CustomEvent(MAP_MODE_EVENT, { detail: mode }));
    } catch {}
  }
}

export function isWithinAngrenBounds(center: [number, number]): boolean {
  if (!Array.isArray(center) || center.length < 2) return false;
  const [lat, lng] = center;
  return (
    lat >= ANGREN_RESTRICT_BOUNDS[0][0] &&
    lat <= ANGREN_RESTRICT_BOUNDS[1][0] &&
    lng >= ANGREN_RESTRICT_BOUNDS[0][1] &&
    lng <= ANGREN_RESTRICT_BOUNDS[1][1]
  );
}

export function getMapCamera(): MapCameraState {
  if (typeof window !== "undefined") {
    try {
      const savedCam = sessionStorage.getItem(MAP_CAMERA_KEY);
      if (savedCam) {
        const parsed = JSON.parse(savedCam);
        if (Array.isArray(parsed.center) && typeof parsed.zoom === "number") {
          const normalized = normalizeCameraCenter(parsed.center);
          if (isWithinAngrenBounds(normalized) && parsed.zoom >= ANGREN_MIN_ZOOM && parsed.zoom <= ANGREN_MAX_ZOOM) {
            inMemoryCamera = {
              center: normalized,
              zoom: parsed.zoom,
            };
            return inMemoryCamera;
          }
        }
      }
    } catch {}
  }
  return inMemoryCamera;
}

export function saveMapCamera(center: [number, number], zoom: number): void {
  inMemoryCamera = { center, zoom };
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(MAP_CAMERA_KEY, JSON.stringify(inMemoryCamera));
    } catch {}
  }
}

function subscribeToMapMode(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MAP_MODE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(MAP_MODE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getClientSnapshot(): MapMode {
  return getStoredMapMode();
}

function getServerSnapshot(): MapMode {
  return "satellite";
}

export function useMapMode(): [MapMode, (mode: MapMode) => void] {
  const mode = useSyncExternalStore(subscribeToMapMode, getClientSnapshot, getServerSnapshot);

  const updateMode = useCallback((newMode: MapMode) => {
    setStoredMapMode(newMode);
  }, []);

  return [mode, updateMode];
}
