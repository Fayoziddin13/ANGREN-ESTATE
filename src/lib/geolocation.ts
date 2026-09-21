"use client";

import { useState, useEffect, useCallback } from "react";

export const ANGREN_CENTER = {
  lat: 41.012277,
  lng: 70.085182,
};

export const ANGREN_RADIUS_KM = 18;
export const TASHKENT_CENTER = {
  lat: 41.2995,
  lng: 69.2401,
};

export interface CoarseLocation {
  city: string;
  region: string;
  country: string;
}

export interface UserLocationResult {
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  inAngren: boolean;
  isWithinAngren: boolean;
  distanceToAngrenKm: number;
  distanceFromAngrenKm: number;
  city: string;
  region: string;
  country: string;
  coarseLocation: CoarseLocation;
}

// Haversine formula
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function isWithinAngren(lat: number, lng: number): boolean {
  return getDistanceKm(lat, lng, ANGREN_CENTER.lat, ANGREN_CENTER.lng) <= ANGREN_RADIUS_KM;
}

export function getCoarseLocation(lat: number, lng: number): CoarseLocation {
  const distToAngren = getDistanceKm(lat, lng, ANGREN_CENTER.lat, ANGREN_CENTER.lng);
  if (distToAngren <= 25) {
    return { city: "Angren", region: "Toshkent viloyati", country: "O‘zbekiston" };
  }

  const distToTashkent = getDistanceKm(lat, lng, TASHKENT_CENTER.lat, TASHKENT_CENTER.lng);
  if (distToTashkent <= 35) {
    return { city: "Toshkent", region: "Toshkent shahri", country: "O‘zbekiston" };
  }

  // Rough Uzbekistan bounding box: 37°N - 45.6°N, 56°E - 73.2°E
  if (lat >= 37.0 && lat <= 45.6 && lng >= 56.0 && lng <= 73.2) {
    return { city: "Boshqa hududlar", region: "O‘zbekiston", country: "O‘zbekiston" };
  }

  return { city: "Xorijiy / Boshqa", region: "Xorij", country: "Boshqa" };
}

export function requestBrowserLocation(options: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60000,
}): Promise<UserLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("GEOLOCATION_NOT_SUPPORTED"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        const distanceToAngrenKm = getDistanceKm(lat, lng, ANGREN_CENTER.lat, ANGREN_CENTER.lng);
        const inAngren = distanceToAngrenKm <= ANGREN_RADIUS_KM;
        const coarseLocation = getCoarseLocation(lat, lng);

        resolve({
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          accuracy,
          inAngren,
          isWithinAngren: inAngren,
          distanceToAngrenKm,
          distanceFromAngrenKm: distanceToAngrenKm,
          city: coarseLocation.city,
          region: coarseLocation.region,
          country: coarseLocation.country,
          coarseLocation,
        });
      },
      (err) => {
        reject(err);
      },
      options
    );
  });
}

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"granted" | "prompt" | "denied" | "unknown">("unknown");

  const locateUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loc = await requestBrowserLocation();
      setUserLocation(loc);
      return loc;
    } catch (err: any) {
      const code = err?.code;
      let errMsg = "Joylashuvni aniqlash imkoni bo‘lmadi.";
      if (code === 1) errMsg = "Geolokatsiyaga ruxsat berilmadi.";
      else if (code === 2) errMsg = "Joylashuv ma’lumoti mavjud emas.";
      else if (code === 3) errMsg = "Joylashuvni aniqlash vaqti tugadi.";
      setError(errMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((res) => {
          setPermissionState(res.state as any);
          if (res.state === "granted") {
            locateUser();
          }
          res.onchange = () => {
            setPermissionState(res.state as any);
            if (res.state === "granted") {
              locateUser();
            }
          };
        })
        .catch(() => {});
    }
  }, [locateUser]);

  return {
    location: userLocation,
    userLocation,
    loading: isLoading,
    isLoading,
    error,
    permissionState,
    requestLocation: locateUser,
    locateUser,
  };
}
