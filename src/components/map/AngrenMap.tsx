"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { LocateFixed, Plus, Minus } from "lucide-react";
import {
  getMapCamera,
  saveMapCamera,
  DEFAULT_ANGREN_CENTER,
  DEFAULT_MAP_ZOOM,
  ANGREN_RESTRICT_BOUNDS,
  ANGREN_MIN_ZOOM,
  ANGREN_MAX_ZOOM,
} from "@/lib/mapStore";

declare global {
  interface Window {
    ymaps?: any;
    __ymapsLoadingPromise?: Promise<any>;
  }
}

interface AngrenMapProps {
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property | null) => void;
  mapMode: "standard" | "satellite";
  onMapModeChange: (mode: "standard" | "satellite") => void;
  className?: string;
  focusDistrict?: string | null;
}

export const ANGREN_CENTER: [number, number] = DEFAULT_ANGREN_CENTER; // [41.0185, 70.1340]
export const DEFAULT_ZOOM = DEFAULT_MAP_ZOOM; // 13.8

function getPropertyIconSvg(type: string): string {
  switch (type) {
    case "house_yard":
    case "house":
    case "townhouse":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
    case "apartment":
    case "new_build":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`;
    case "land":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>`;
    case "commercial":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
  }
}

// Script loader helper for Yandex Maps API v2.1
function loadYandexMaps(locale: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Window undefined"));
  if (window.ymaps) {
    return new Promise((resolve) => window.ymaps.ready(() => resolve(window.ymaps)));
  }

  if (window.__ymapsLoadingPromise) {
    return window.__ymapsLoadingPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";
  // Yandex Maps API v2.1 uses ru_RU for CIS/Uzbekistan regional cartography
  const lang = "ru_RU";
  const scriptUrl = `https://api-maps.yandex.ru/2.1/?lang=${lang}${apiKey ? `&apikey=${apiKey}` : ""}`;

  window.__ymapsLoadingPromise = new Promise((resolve, reject) => {
    // Check if script element already exists
    const existing = document.querySelector(`script[src*="api-maps.yandex.ru"]`);
    if (existing) {
      const checkYmaps = () => {
        if (window.ymaps) {
          window.ymaps.ready(() => resolve(window.ymaps));
        } else {
          setTimeout(checkYmaps, 100);
        }
      };
      checkYmaps();
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => resolve(window.ymaps));
      } else {
        reject(new Error("ymaps not defined after script load"));
      }
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return window.__ymapsLoadingPromise;
}

export function AngrenMap({
  properties,
  selectedProperty,
  onSelectProperty,
  mapMode,
  onMapModeChange,
  className = "",
  focusDistrict,
}: AngrenMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const { locale, t } = useLanguage();
  const { currency } = useCurrency();

  // Helper to format short price on marker pill
  const formatMarkerPrice = useCallback(
    (priceUzs: number, isSale: boolean): string => {
      if (currency === "USD") {
        const usd = Math.round(priceUzs / 12800);
        if (usd >= 1000000) {
          const m = usd / 1000000;
          const fmt = m % 1 === 0 ? m.toString() : m.toFixed(1);
          return isSale ? `$${fmt}M` : `$${fmt}M/oy`;
        }
        if (usd >= 1000) {
          const k = Math.round(usd / 1000);
          return isSale ? `$${k}k` : `$${usd}/oy`;
        }
        return isSale ? `$${usd}` : `$${usd}/oy`;
      }

      // UZS
      if (priceUzs >= 1000000000) {
        const mlrd = priceUzs / 1000000000;
        const fmt = mlrd % 1 === 0 ? mlrd.toString() : mlrd.toFixed(1);
        return isSale ? `${fmt} mlrd` : `${fmt} mlrd/oy`;
      }

      const mln = priceUzs / 1000000;
      if (mln >= 1) {
        const fmt = mln % 1 === 0 ? mln.toString() : mln.toFixed(1);
        return isSale ? `${fmt} mln` : `${fmt} mln/oy`;
      }

      const k = Math.round(priceUzs / 1000);
      return isSale ? `${k} ming` : `${k} ming/oy`;
    },
    [currency]
  );

  // 1. Initialize Yandex Map once on container mount
  useEffect(() => {
    let isMounted = true;

    loadYandexMaps(locale)
      .then((ymaps) => {
        if (!isMounted || !mapContainerRef.current || mapRef.current) return;

        const initialCam = getMapCamera();
        const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
        const targetDefaultZoom = isMobile ? 13.6 : DEFAULT_ZOOM;
        const initialCenter = initialCam?.center || ANGREN_CENTER;
        const initialZoom = initialCam?.zoom || targetDefaultZoom;
        const initialType = mapMode === "satellite" ? "yandex#satellite" : "yandex#map";

        const map = new ymaps.Map(
          mapContainerRef.current,
          {
            center: initialCenter,
            zoom: initialZoom,
            type: initialType,
            controls: [],
          },
          {
            restrictMapArea: ANGREN_RESTRICT_BOUNDS,
            minZoom: ANGREN_MIN_ZOOM,
            maxZoom: ANGREN_MAX_ZOOM,
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true,
          }
        );

        // Custom cluster layout with glowing dot and property count
        const clusterLayout = ymaps.templateLayoutFactory.createClass(
          `<div class="angren-cluster-badge select-none cursor-pointer">
            <div class="angren-cluster-inner">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#34D399; box-shadow:0 0 6px #34D399;"></span>
              <span>$[properties.geoObjects.length]</span>
            </div>
          </div>`
        );

        const clusterer = new ymaps.Clusterer({
          clusterIconLayout: clusterLayout,
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterHideIconOnBalloonOpen: false,
          geoObjectHideIconOnBalloonOpen: false,
          minClusterSize: 2,
          gridSize: 64,
        });

        map.geoObjects.add(clusterer);

        // Update stored camera state on map movements
        map.events.add("boundschange", () => {
          if (!map) return;
          const center = map.getCenter();
          const zoom = map.getZoom();
          saveMapCamera([center[0], center[1]], zoom);
        });

        // Clicking empty map background clears selected property
        map.events.add("click", () => {
          onSelectProperty(null);
        });

        mapRef.current = map;
        clustererRef.current = clusterer;
        if (typeof window !== "undefined") {
          (window as any).__angrenYmapInstance = map;
          (window as any).__angrenYmapClusterer = clusterer;
        }
        setIsMapReady(true);
      })
      .catch((err) => {
        console.error("[YandexAngrenMap] Failed to load Yandex Maps:", err);
      });

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        if ((window as any).__angrenYmapInstance === mapRef.current) {
          (window as any).__angrenYmapInstance = null;
          (window as any).__angrenYmapClusterer = null;
        }
      }
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {}
        mapRef.current = null;
        clustererRef.current = null;
      }
    };
  }, [locale]);

  // 2. Seamlessly toggle between Satellite and Standard (Zero reinitialization)
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const targetType = mapMode === "satellite" ? "yandex#satellite" : "yandex#map";
    try {
      if (mapRef.current.getType() !== targetType) {
        mapRef.current.setType(targetType);
      }
    } catch (err) {
      console.warn("[YandexAngrenMap] Error switching map type:", err);
    }
  }, [mapMode, isMapReady]);

  // 3. Render Custom Placemarks & Clusters on Property list changes
  useEffect(() => {
    if (!mapRef.current || !clustererRef.current || !isMapReady || !window.ymaps) return;

    const ymaps = window.ymaps;
    const clusterer = clustererRef.current;
    clusterer.removeAll();

    // Template layout for custom premium property pin
    const markerLayout = ymaps.templateLayoutFactory.createClass(
      `<div class="angren-property-pin" data-prop-id="$[properties.propertyId]">
        <div class="angren-pin-body" style="background: $[properties.bgColor]; border: $[properties.border]; $[properties.bodyStyle]">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;color:#ffffff;flex-shrink:0;">$[properties.iconHtml]</span>
          <span style="white-space:nowrap;">$[properties.priceText]</span>
        </div>
        <div class="angren-pin-tip" style="border-top: 5px solid $[properties.tipColor];"></div>
      </div>`
    );

    const placemarks: any[] = [];

    properties.forEach((property) => {
      const isSelected = selectedProperty?.id === property.id;
      const isSale = property.transaction_type === "sale";
      const priceText = formatMarkerPrice(property.price_uzs, isSale);
      const iconHtml = getPropertyIconSvg(property.property_type);

      // Sale color: #16543C, Rent color: #1D4ED8
      const bgColor = isSelected
        ? isSale
          ? "#0E3324"
          : "#1E3A8A"
        : isSale
        ? "#16543C"
        : "#1D4ED8";

      const tipColor = bgColor;

      const border = isSelected
        ? isSale
          ? "2px solid #34D399"
          : "2px solid #38BDF8"
        : "1.5px solid rgba(255,255,255,0.95)";

      const bodyStyle = isSelected
        ? isSale
          ? "box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.4), 0 6px 20px rgba(0,0,0,0.55); transform: scale(1.1);"
          : "box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.4), 0 6px 20px rgba(0,0,0,0.55); transform: scale(1.1);"
        : "";

      const placemark = new ymaps.Placemark(
        [property.coordinates.lat, property.coordinates.lng],
        {
          propertyId: property.id,
          priceText,
          bgColor,
          tipColor,
          border,
          bodyStyle,
          iconHtml,
        },
        {
          iconLayout: markerLayout,
          iconPane: "overlaps",
          zIndex: isSelected ? 1000 : 100,
        }
      );

      placemark.events.add("click", (e: any) => {
        e.stopPropagation();
        onSelectProperty(property);
        if (mapRef.current) {
          mapRef.current.panTo([property.coordinates.lat, property.coordinates.lng], {
            duration: 500,
            flying: true,
          });
        }
      });

      placemarks.push(placemark);
    });

    clusterer.add(placemarks);
  }, [properties, selectedProperty, isMapReady, formatMarkerPrice, onSelectProperty]);

  // 4. Update Polygon boundary when selected property has polygon coordinates
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !window.ymaps) return;
    const ymaps = window.ymaps;

    // Remove existing polygon if any
    if (polygonRef.current) {
      try {
        mapRef.current.geoObjects.remove(polygonRef.current);
      } catch {}
      polygonRef.current = null;
    }

    if (selectedProperty?.polygon && selectedProperty.polygon.length >= 3) {
      const coords = selectedProperty.polygon.map(([lat, lng]) => [lat, lng]);
      // Ensure closed loop
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push(coords[0]);
      }

      const polygon = new ymaps.Polygon(
        [coords],
        {},
        {
          fillColor: "#16543C40",
          strokeColor: "#16543C",
          strokeWidth: 2.5,
          strokeOpacity: 0.9,
        }
      );

      mapRef.current.geoObjects.add(polygon);
      polygonRef.current = polygon;
    }
  }, [selectedProperty, isMapReady]);

  // 5. Center map on selected property
  useEffect(() => {
    if (!selectedProperty || !mapRef.current || !isMapReady) return;
    mapRef.current.panTo([selectedProperty.coordinates.lat, selectedProperty.coordinates.lng], {
      duration: 600,
      flying: true,
    });
  }, [selectedProperty, isMapReady]);

  // 6. Focus on district when selected
  useEffect(() => {
    if (!focusDistrict || focusDistrict === "all" || !mapRef.current || !isMapReady) return;

    // Angren district centers in [latitude, longitude] format
    const districtCoords: Record<string, [number, number]> = {
      markaz: [41.0167, 70.1436],
      "5-mavze": [41.0125, 70.138],
      "6-mavze": [41.019, 70.132],
      "7-mavze": [41.024, 70.126],
      dukent: [41.038, 70.175],
      geolog: [41.008, 70.155],
      yangiobod: [41.042, 70.108],
    };

    const key = Object.keys(districtCoords).find((k) =>
      focusDistrict.toLowerCase().includes(k)
    );
    if (key && districtCoords[key]) {
      mapRef.current.panTo(districtCoords[key], {
        duration: 700,
        flying: true,
      });
      mapRef.current.setZoom(14.2, { duration: 600 });
    }
  }, [focusDistrict, isMapReady]);

  // Navigation Button Handlers
  const handleZoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() + 1, {
      duration: 250,
      checkZoomRange: true,
    });
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() - 1, {
      duration: 250,
      checkZoomRange: true,
    });
  };

  const handleResetCenter = () => {
    if (!mapRef.current) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const targetZoom = isMobile ? 13.6 : DEFAULT_ZOOM;
    mapRef.current.panTo(ANGREN_CENTER, { duration: 700, flying: true });
    mapRef.current.setZoom(targetZoom, { duration: 600 });
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div
        ref={mapContainerRef}
        id="yandex-map-container"
        data-testid="yandex-map-container"
        className="w-full h-full"
      />

      {/* Floating Glass Navigation Controls: [ Reset Center ], [ + ], [ - ] */}
      <div className="hidden sm:flex flex-col items-center gap-1.5 absolute bottom-8 right-5 z-20 pointer-events-auto">
        <button
          onClick={handleResetCenter}
          data-testid="map-reset-center"
          title={locale === "uz" ? "Angren markaziga qaytish" : "Центр Ангрена"}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 backdrop-blur-xl text-gray-700 hover:text-[#16543C] shadow-elevated border border-white/80 hover:bg-white transition-all active:scale-95"
        >
          <LocateFixed className="h-4 w-4" />
        </button>

        <div className="flex flex-col rounded-2xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden">
          <button
            onClick={handleZoomIn}
            data-testid="map-zoom-in"
            className="flex h-9 w-10 items-center justify-center text-gray-700 hover:text-[#16543C] hover:bg-white transition-colors border-b border-gray-100 active:scale-95"
            aria-label="Zoom In"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            data-testid="map-zoom-out"
            className="flex h-9 w-10 items-center justify-center text-gray-700 hover:text-[#16543C] hover:bg-white transition-colors active:scale-95"
            aria-label="Zoom Out"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
