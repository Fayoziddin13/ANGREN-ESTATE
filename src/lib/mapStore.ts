"use client";

import { useSyncExternalStore, useCallback } from "react";

export type MapMode = "standard" | "satellite";
export type MapDimension = "2d" | "3d";

export interface MapCameraState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  dimension: MapDimension;
}

const MAP_MODE_KEY = "angren_map_style_v1";
const MAP_CAMERA_KEY = "angren_map_camera_v1";
const MAP_DIMENSION_KEY = "angren_map_dimension_v1";
const MAP_MODE_EVENT = "angren_map_mode_change";
const MAP_DIMENSION_EVENT = "angren_map_dimension_change";

// Angren official center point
export const DEFAULT_ANGREN_CENTER: [number, number] = [41.012277, 70.085182];
export const DEFAULT_MAP_ZOOM = 13.8;
export const DEFAULT_MAP_PITCH_3D = 45;
export const DEFAULT_MAP_PITCH_2D = 0;

// Angren City geographic navigation boundaries [South-West [lat, lng], North-East [lat, lng]]
export const ANGREN_RESTRICT_BOUNDS: [[number, number], [number, number]] = [
  [40.9400, 69.9800], // Southwest: Qorabog', A373 gateway, southern riverbank
  [41.1000, 70.2800], // Northeast: Dukent, northern foothills, eastern districts
];

export const ANGREN_MIN_ZOOM = 12.0;
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
let inMemoryDimension: MapDimension = "3d";
let inMemoryCamera: MapCameraState = {
  center: DEFAULT_ANGREN_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
  pitch: DEFAULT_MAP_PITCH_3D,
  bearing: 0,
  dimension: "3d",
};

// Client initialization
if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem(MAP_MODE_KEY);
    if (saved === "standard" || saved === "satellite") {
      inMemoryMode = saved;
    }
    const savedDim = localStorage.getItem(MAP_DIMENSION_KEY);
    if (savedDim === "2d" || savedDim === "3d") {
      inMemoryDimension = savedDim;
    }
    const savedCam = sessionStorage.getItem(MAP_CAMERA_KEY);
    if (savedCam) {
      const parsed = JSON.parse(savedCam);
      if (Array.isArray(parsed.center) && typeof parsed.zoom === "number") {
        inMemoryCamera = {
          center: normalizeCameraCenter(parsed.center),
          zoom: parsed.zoom,
          pitch: typeof parsed.pitch === "number" ? parsed.pitch : (inMemoryDimension === "3d" ? DEFAULT_MAP_PITCH_3D : 0),
          bearing: typeof parsed.bearing === "number" ? parsed.bearing : 0,
          dimension: (parsed.dimension === "2d" || parsed.dimension === "3d") ? parsed.dimension : inMemoryDimension,
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

export function getStoredMapDimension(): MapDimension {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(MAP_DIMENSION_KEY);
      if (saved === "2d" || saved === "3d") {
        inMemoryDimension = saved;
        return saved;
      }
    } catch {}
  }
  return inMemoryDimension;
}

export function setStoredMapDimension(dim: MapDimension): void {
  inMemoryDimension = dim;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MAP_DIMENSION_KEY, dim);
      window.dispatchEvent(new CustomEvent(MAP_DIMENSION_EVENT, { detail: dim }));
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
              pitch: typeof parsed.pitch === "number" ? parsed.pitch : (inMemoryDimension === "3d" ? DEFAULT_MAP_PITCH_3D : 0),
              bearing: typeof parsed.bearing === "number" ? parsed.bearing : 0,
              dimension: (parsed.dimension === "2d" || parsed.dimension === "3d") ? parsed.dimension : inMemoryDimension,
            };
            return inMemoryCamera;
          }
        }
      }
    } catch {}
  }
  return inMemoryCamera;
}

export function saveMapCamera(
  center: [number, number],
  zoom: number,
  pitch?: number,
  bearing?: number,
  dimension?: MapDimension
): void {
  const normCenter = normalizeCameraCenter(center);
  inMemoryCamera = {
    center: normCenter,
    zoom,
    pitch: typeof pitch === "number" ? pitch : inMemoryCamera.pitch,
    bearing: typeof bearing === "number" ? bearing : inMemoryCamera.bearing,
    dimension: dimension || inMemoryCamera.dimension,
  };
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

function subscribeToMapDimension(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(MAP_DIMENSION_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(MAP_DIMENSION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getDimensionClientSnapshot(): MapDimension {
  return getStoredMapDimension();
}

function getDimensionServerSnapshot(): MapDimension {
  return "3d";
}

export function useMapDimension(): [MapDimension, (dim: MapDimension) => void] {
  const dim = useSyncExternalStore(subscribeToMapDimension, getDimensionClientSnapshot, getDimensionServerSnapshot);

  const updateDim = useCallback((newDim: MapDimension) => {
    setStoredMapDimension(newDim);
  }, []);

  return [dim, updateDim];
}

