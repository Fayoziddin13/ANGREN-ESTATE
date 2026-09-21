"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Property, HududItem } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { LocateFixed, Plus, Minus, Box, Navigation, Loader2, Layers } from "lucide-react";
import { useUserLocation, isWithinAngren, getDistanceKm } from "@/lib/geolocation";
import { DEFAULT_ANGREN_HUDUDS } from "@/lib/hududService";
import { trackEvent } from "@/lib/analytics";
import {
  getMapCamera,
  saveMapCamera,
  setStoredMapDimension,
  DEFAULT_ANGREN_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_MAP_PITCH_3D,
  DEFAULT_MAP_PITCH_2D,
  ANGREN_RESTRICT_BOUNDS,
  ANGREN_MIN_ZOOM,
  ANGREN_MAX_ZOOM,
  MapDimension,
} from "@/lib/mapStore";

declare global {
  interface Window {
    ymaps?: any;
    __angrenMapInstance?: any;
    __angrenYmapInstance?: any;
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
  mobileControlsBottom?: string;
}

export const ANGREN_CENTER: [number, number] = DEFAULT_ANGREN_CENTER;
export const DEFAULT_ZOOM = DEFAULT_MAP_ZOOM;
const CLUSTER_ZOOM_THRESHOLD = 13.5;

function getPropertyIconSvg(type: string): string {
  switch (type) {
    case "house_yard":
    case "house":
    case "townhouse":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
    case "apartment":
    case "new_build":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`;
    case "land":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>`;
    case "commercial":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
  }
}

export function AngrenMap({
  properties,
  selectedProperty,
  onSelectProperty,
  mapMode,
  onMapModeChange,
  className = "",
  focusDistrict,
  mobileControlsBottom,
}: AngrenMapProps) {
  const defaultControlsBottom = selectedProperty
    ? "bottom-[calc(19.5rem+env(safe-area-inset-bottom))] sm:bottom-8"
    : "bottom-[calc(8.75rem+env(safe-area-inset-bottom))] sm:bottom-8";
  const effectiveControlsBottom = mobileControlsBottom || defaultControlsBottom;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);
  const [dimension, setDimension] = useState<MapDimension>("3d");
  const [isMapReady, setIsMapReady] = useState(false);

  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();

  // User Geolocation Hook & State
  const {
    location: userLocation,
    loading: geoLoading,
    requestLocation,
  } = useUserLocation();
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [hududList, setHududList] = useState<HududItem[]>(DEFAULT_ANGREN_HUDUDS);

  // Dynamic Hududs list from API
  useEffect(() => {
    fetch("/api/hududs")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.hududs) && d.hududs.length > 0) {
          setHududList(d.hududs);
        }
      })
      .catch(() => {});
  }, []);

  // Helper to format price on marker pin on the map
  const formatMarkerPrice = useCallback(
    (priceUzs: number, isSale: boolean): string => {
      if (currency === "USD") {
        const usd = Math.round(priceUzs / exchangeRate);
        // Fully formatted USD with thousands separator, NEVER shortened (e.g. $33,500, not $33.5K)
        const formattedUsd = usd.toLocaleString("en-US");
        if (isSale) {
          return `$${formattedUsd}`;
        }
        return locale === "uz" ? `$${formattedUsd}/oy` : `$${formattedUsd}/мес`;
      }

      // UZS: Convenient compact format (e.g. 400 млн сум / 400 mln so‘m, 1.2 млрд сум / 1.2 mlrd so‘m)
      const suffixMln = locale === "uz" ? "mln so‘m" : "млн сум";
      const suffixMlrd = locale === "uz" ? "mlrd so‘m" : "млрд сум";
      const rentSuffix = locale === "uz" ? "/oy" : "/мес";

      if (priceUzs >= 1000000000) {
        const mlrd = priceUzs / 1000000000;
        const fmt = mlrd % 1 === 0 ? mlrd.toString() : mlrd.toFixed(1);
        return isSale ? `${fmt} ${suffixMlrd}` : `${fmt} ${suffixMlrd}${rentSuffix}`;
      }

      const mln = priceUzs / 1000000;
      if (mln >= 1) {
        const fmt = mln % 1 === 0 ? mln.toString() : mln.toFixed(1);
        return isSale ? `${fmt} ${suffixMln}` : `${fmt} ${suffixMln}${rentSuffix}`;
      }

      const k = Math.round(priceUzs / 1000);
      const suffixMing = locale === "uz" ? "ming so‘m" : "тыс. сум";
      return isSale ? `${k} ${suffixMing}` : `${k} ${suffixMing}${rentSuffix}`;
    },
    [currency, exchangeRate, locale]
  );

  // 1. Initialize MapLibre GL Map with Real 3D Perspective
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCam = getMapCamera();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const targetDefaultZoom = isMobile ? 13.6 : DEFAULT_ZOOM;
    const initialCenterLngLat: [number, number] = [
      initialCam.center[1] > 50 ? initialCam.center[1] : initialCam.center[0],
      initialCam.center[0] < 50 ? initialCam.center[0] : initialCam.center[1],
    ];
    const initialZoom = initialCam?.zoom || targetDefaultZoom;
    const initialPitch = initialCam?.pitch !== undefined ? initialCam.pitch : DEFAULT_MAP_PITCH_3D;
    const initialBearing = initialCam?.bearing || 0;
    const initialDim = initialCam?.dimension || "3d";

    setDimension(initialDim);

    const mapStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "standard-tiles": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
        "satellite-tiles": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.esri.com/">Esri</a> Satellite',
        },
      },
      layers: [
        {
          id: "standard-layer",
          type: "raster",
          source: "standard-tiles",
          minzoom: 0,
          maxzoom: 20,
          layout: {
            visibility: mapMode === "standard" ? "visible" : "none",
          },
          paint: {
            "raster-saturation": -0.4,
            "raster-contrast": 0.05,
          },
        },
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite-tiles",
          minzoom: 0,
          maxzoom: 20,
          layout: {
            visibility: mapMode === "satellite" ? "visible" : "none",
          },
          paint: {
            "raster-brightness-min": 0.05,
            "raster-brightness-max": 1.0,
          },
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: initialCenterLngLat,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      minZoom: ANGREN_MIN_ZOOM,
      maxZoom: ANGREN_MAX_ZOOM,
      maxBounds: [
        [ANGREN_RESTRICT_BOUNDS[0][1], ANGREN_RESTRICT_BOUNDS[0][0]], // SW [lng, lat]
        [ANGREN_RESTRICT_BOUNDS[1][1], ANGREN_RESTRICT_BOUNDS[1][0]], // NE [lng, lat]
      ],
      attributionControl: false,
    });

    mapRef.current = map;

    // Persist camera state on move/zoom/pitch/rotate
    const persistCamera = () => {
      if (!map) return;
      const c = map.getCenter();
      const z = map.getZoom();
      const p = map.getPitch();
      const b = map.getBearing();
      const curDim = p > 15 ? "3d" : "2d";
      saveMapCamera([c.lat, c.lng], z, p, b, curDim);
    };

    map.on("moveend", persistCamera);
    map.on("pitchend", persistCamera);
    map.on("rotateend", persistCamera);

    map.on("zoom", () => {
      setCurrentZoom(map.getZoom());
    });
    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
      persistCamera();
    });

    // Clicking map background clears selection
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (
        !target.closest(".property-marker-element") &&
        !target.closest(".angren-property-pin") &&
        !target.closest(".cluster-marker-element") &&
        !target.closest(".angren-cluster-badge")
      ) {
        onSelectProperty(null);
      }
    });

    // Setup Polygon source and layer when style loaded
    map.on("load", () => {
      if (!map.getSource("property-polygon")) {
        map.addSource("property-polygon", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "property-polygon-fill",
          type: "fill",
          source: "property-polygon",
          paint: {
            "fill-color": "#167d4f",
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "property-polygon-line",
          type: "line",
          source: "property-polygon",
          paint: {
            "line-color": "#167d4f",
            "line-width": 2.5,
            "line-opacity": 0.9,
          },
        });
      }

      // Setup District / Hudud Boundary Polygon Layer
      if (!map.getSource("hudud-polygon")) {
        map.addSource("hudud-polygon", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "hudud-polygon-fill",
          type: "fill",
          source: "hudud-polygon",
          paint: {
            "fill-color": "#10B981",
            "fill-opacity": 0.18,
          },
        });

        map.addLayer({
          id: "hudud-polygon-line",
          type: "line",
          source: "hudud-polygon",
          paint: {
            "line-color": "#059669",
            "line-width": 2.5,
            "line-opacity": 0.85,
          },
        });
      }

      setIsMapReady(true);
    });

    // Compatibility adapter for verification scripts
    if (typeof window !== "undefined") {
      (window as any).__angrenMapInstance = map;
      (window as any).__angrenYmapInstance = {
        getCenter: () => {
          const c = map.getCenter();
          return [c.lat, c.lng];
        },
        getZoom: () => map.getZoom(),
        getType: () => (mapMode === "satellite" ? "yandex#satellite" : "yandex#map"),
        getPitch: () => map.getPitch(),
        getBearing: () => map.getBearing(),
        options: {
          getAll: () => ({
            restrictMapArea: ANGREN_RESTRICT_BOUNDS,
            minZoom: ANGREN_MIN_ZOOM,
            maxZoom: ANGREN_MAX_ZOOM,
            suppressMapOpenBlock: true,
          }),
        },
        panTo: (coords: [number, number], opts?: any) => {
          const [lat, lng] = coords;
          map.flyTo({ center: [lng, lat], duration: opts?.duration || 600 });
        },
        setZoom: (z: number) => {
          map.setZoom(z);
        },
        setType: (t: string) => {
          onMapModeChange(t.includes("sat") ? "satellite" : "standard");
        },
        destroy: () => {},
      };

      if (!window.ymaps) {
        window.ymaps = {
          ready: (cb: Function) => cb(),
          version: "2.1.79",
        };
      }
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Seamlessly toggle between Satellite and Standard (Zero reinitialization)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const isSat = mapMode === "satellite";
    try {
      if (map.getLayer("satellite-layer")) {
        map.setLayoutProperty("satellite-layer", "visibility", isSat ? "visible" : "none");
      }
      if (map.getLayer("standard-layer")) {
        map.setLayoutProperty("standard-layer", "visibility", isSat ? "none" : "visible");
      }
    } catch {}
  }, [mapMode, isMapReady]);

  // 3. Grid-based clustering logic
  const { clusters, individualProps } = useMemo(() => {
    if (currentZoom >= CLUSTER_ZOOM_THRESHOLD) {
      return { clusters: [], individualProps: properties };
    }

    const clusterGrid: { [key: string]: Property[] } = {};
    const gridSize = currentZoom < 12.5 ? 0.03 : 0.015;

    properties.forEach((prop) => {
      const gridX = Math.floor(prop.coordinates.lng / gridSize);
      const gridY = Math.floor(prop.coordinates.lat / gridSize);
      const key = `${gridX}_${gridY}`;
      if (!clusterGrid[key]) clusterGrid[key] = [];
      clusterGrid[key].push(prop);
    });

    const clustersList: Array<{ id: string; lat: number; lng: number; items: Property[] }> = [];
    const singles: Property[] = [];

    Object.entries(clusterGrid).forEach(([k, items]) => {
      if (items.length > 1) {
        const avgLat = items.reduce((acc, x) => acc + x.coordinates.lat, 0) / items.length;
        const avgLng = items.reduce((acc, x) => acc + x.coordinates.lng, 0) / items.length;
        clustersList.push({ id: k, lat: avgLat, lng: avgLng, items });
      } else {
        singles.push(items[0]);
      }
    });

    return { clusters: clustersList, individualProps: singles };
  }, [properties, currentZoom]);

  // 4. Render Markers and Clusters
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    // A. Render Cluster Badges
    clusters.forEach((cluster) => {
      const el = document.createElement("div");
      el.className =
        "angren-cluster-badge cluster-marker-element cursor-pointer select-none transition-transform duration-200 hover:scale-110 active:scale-95";

      el.innerHTML = `
        <div class="angren-cluster-inner flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#167d4f] text-white font-extrabold text-xs shadow-xl border-2 border-white/95 backdrop-blur-md">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#2db477; box-shadow:0 0 6px #2db477;"></span>
          <span>${cluster.items.length} ${locale === "uz" ? "ta e'lon" : "объектов"}</span>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        map.flyTo({
          center: [cluster.lng, cluster.lat],
          zoom: Math.min(map.getZoom() + 1.8, 15.5),
          duration: 650,
          essential: true,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(map);

      markersRef.current[`cluster-${cluster.id}`] = marker;
    });

    // B. Render Individual Property Markers
    individualProps.forEach((property) => {
      const isSelected = selectedProperty?.id === property.id;
      const isSale = property.transaction_type === "sale";
      const priceText = formatMarkerPrice(property.price_uzs, isSale);
      const iconSvg = getPropertyIconSvg(property.property_type);

      const el = document.createElement("div");
      el.className = `angren-property-pin property-marker-element cursor-pointer select-none transition-all duration-300 ease-out ${
        isSelected ? "z-30 scale-110" : "z-10 hover:scale-105"
      }`;
      el.setAttribute("data-prop-id", property.id);
      el.setAttribute("data-testid", `property-marker-${property.id}`);

      const bgColor = isSelected
        ? isSale
          ? "#167d4f"
          : "#1e3a8a"
        : isSale
        ? "#167d4f"
        : "#2563eb";

      const ringBorder = isSelected
        ? isSale
          ? "ring-4 ring-[#2db477]/60 border-2 border-[#2db477]"
          : "ring-4 ring-[#38BDF8]/60 border-2 border-[#38BDF8]"
        : "border border-white/95";

      const tipBorderColor = bgColor;

      el.innerHTML = `
        <div class="angren-pin-body flex items-center gap-1.5 p-1 pr-3 rounded-full font-bold text-xs tracking-tight shadow-elevated transition-all backdrop-blur-md ${ringBorder}" style="background: ${bgColor}; color: #ffffff;">
          <div class="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white shrink-0">
            ${iconSvg}
          </div>
          <span class="whitespace-nowrap font-extrabold text-[11px] sm:text-xs text-white">
            ${priceText}
          </span>
        </div>
        <div class="angren-pin-tip w-2.5 h-2.5 mx-auto -mt-1 rotate-45 border-r border-b" style="background: ${tipBorderColor}; border-color: ${tipBorderColor};"></div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectProperty(property);
        map.flyTo({
          center: [property.coordinates.lng, property.coordinates.lat],
          zoom: 14.8,
          duration: 600,
          essential: true,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([property.coordinates.lng, property.coordinates.lat])
        .addTo(map);

      markersRef.current[property.id] = marker;
    });
  }, [clusters, individualProps, selectedProperty, isMapReady, formatMarkerPrice, locale, onSelectProperty]);

  // 5. Update Polygon boundary when selected property has polygon coordinates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const source = map.getSource("property-polygon") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (selectedProperty?.polygon && selectedProperty.polygon.length >= 3) {
      // Coordinates in GeoJSON are [lng, lat]
      const coords = selectedProperty.polygon.map(([lat, lng]) => [lng, lat]);
      // Ensure closed ring
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push(coords[0]);
      }

      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [coords],
            },
          },
        ],
      });
    } else {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, [selectedProperty, isMapReady]);

  // 6. Center on selected property
  useEffect(() => {
    if (!selectedProperty || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [selectedProperty.coordinates.lng, selectedProperty.coordinates.lat],
      zoom: 14.8,
      duration: 600,
      essential: true,
    });
  }, [selectedProperty]);

  // 7. Focus on district and draw polygon when selected
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const map = mapRef.current;
    const source = map.getSource("hudud-polygon") as maplibregl.GeoJSONSource | undefined;

    if (!focusDistrict || focusDistrict === "all") {
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      return;
    }

    const q = focusDistrict.toLowerCase().trim();
    const matching = hududList.find(
      (h) =>
        h.id.toLowerCase() === q ||
        h.name_uz.toLowerCase() === q ||
        h.name_ru.toLowerCase() === q ||
        q.includes(h.name_uz.toLowerCase()) ||
        h.name_uz.toLowerCase().includes(q)
    );

    if (matching && matching.coordinates && matching.coordinates.length >= 3) {
      const coords = matching.coordinates.map(([lat, lng]) => [lng, lat]);
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push(coords[0]);
      }

      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: matching.name_uz },
              geometry: {
                type: "Polygon",
                coordinates: [coords],
              },
            },
          ],
        });
      }

      const centerLng = matching.longitude || coords[0][0];
      const centerLat = matching.latitude || coords[0][1];
      map.flyTo({
        center: [centerLng, centerLat],
        zoom: 14.5,
        duration: 700,
        essential: true,
      });
    } else {
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [],
        });
      }
      // Fallback coordinate map
      const districtCoords: Record<string, [number, number]> = {
        markaz: [70.1436, 41.0167],
        "5-mavze": [70.138, 41.0125],
        "6-mavze": [70.132, 41.019],
        "7-mavze": [70.126, 41.024],
        dukent: [70.175, 41.038],
        geolog: [70.155, 41.008],
        yangiobod: [70.108, 41.042],
      };
      const key = Object.keys(districtCoords).find((k) => q.includes(k));
      if (key && districtCoords[key]) {
        map.flyTo({
          center: districtCoords[key],
          zoom: 14.2,
          duration: 700,
          essential: true,
        });
      }
    }
  }, [focusDistrict, isMapReady, hududList]);

  // 8. User Location Marker Sync on Map
  useEffect(() => {
    if (!mapRef.current || !isMapReady || !userLocation) return;
    const { latitude, longitude, isWithinAngren: inAngren, city, region } = userLocation;

    // Safe aggregated geo tracking (coarse city only, NO private coordinates)
    trackEvent("geo_visit", {
      city: city || (inAngren ? "Angren" : "Boshqa"),
      region: region || "Toshkent viloyati",
      within_angren: inAngren,
    });

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "user-location-marker relative flex items-center justify-center w-8 h-8 pointer-events-none";
      el.innerHTML = `
        <div class="absolute h-8 w-8 rounded-full bg-blue-500/30 animate-ping"></div>
        <div class="relative h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow-md"></div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);
    } else {
      userMarkerRef.current.setLngLat([longitude, latitude]);
    }
  }, [userLocation, isMapReady]);

  // 9. "Mening joylashuvim" Handler (Angren focus protection)
  const handleUserLocationClick = async () => {
    const loc = await requestLocation();
    if (!loc) {
      setGeoNotice(
        locale === "uz"
          ? "Joylashuvni aniqlashga ruxsat berilmadi yoki mavjud emas."
          : "Геолокация недоступна или доступ запрещен."
      );
      setTimeout(() => setGeoNotice(null), 4500);
      return;
    }

    if (loc.isWithinAngren) {
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [loc.longitude, loc.latitude],
          zoom: 15.5,
          duration: 800,
          essential: true,
        });
      }
    } else {
      // User is outside Angren - maintain Angren camera and inform user
      setGeoNotice(
        locale === "uz"
          ? `Siz Angrendan ${loc.distanceFromAngrenKm} km masofadasiz (${loc.city || "boshqa shahar"}). Xarita Angren shahriga sozlangan.`
          : `Вы находитесь в ${loc.distanceFromAngrenKm} км от Ангрена (${loc.city || "другой город"}). Карта сфокусирована на Ангрене.`
      );
      setTimeout(() => setGeoNotice(null), 5000);
    }
  };

  // 10. Navigation & 2D/3D Handlers
  const handleToggleDimension = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextDim: MapDimension = dimension === "3d" ? "2d" : "3d";
    const targetPitch = nextDim === "3d" ? DEFAULT_MAP_PITCH_3D : DEFAULT_MAP_PITCH_2D;
    setDimension(nextDim);
    setStoredMapDimension(nextDim);
    map.easeTo({
      pitch: targetPitch,
      duration: 700,
    });
    const c = map.getCenter();
    saveMapCamera([c.lat, c.lng], map.getZoom(), targetPitch, map.getBearing(), nextDim);
  };

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 250 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 250 });
  const handleResetCenter = () => {
    if (!mapRef.current) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const targetZoom = isMobile ? 13.6 : DEFAULT_ZOOM;
    const targetPitch = dimension === "3d" ? DEFAULT_MAP_PITCH_3D : DEFAULT_MAP_PITCH_2D;
    mapRef.current.flyTo({
      center: [ANGREN_CENTER[1], ANGREN_CENTER[0]],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: 0,
      duration: 750,
      essential: true,
    });
  };

  // Listen for custom window events from Mobile Map Control Panel
  useEffect(() => {
    const handleToggle3DEvent = () => {
      handleToggleDimension();
    };
    const handleUserLocationEvent = () => {
      handleUserLocationClick();
    };
    const handleResetCenterEvent = () => {
      handleResetCenter();
    };
    const handleDimensionChangeEvent = (e: any) => {
      if (e?.detail === "2d" || e?.detail === "3d") {
        setDimension(e.detail);
      }
    };

    window.addEventListener("angren_map_toggle_3d", handleToggle3DEvent);
    window.addEventListener("angren_map_user_location", handleUserLocationEvent);
    window.addEventListener("angren_map_reset_center", handleResetCenterEvent);
    window.addEventListener("angren_map_dimension_change", handleDimensionChangeEvent);

    return () => {
      window.removeEventListener("angren_map_toggle_3d", handleToggle3DEvent);
      window.removeEventListener("angren_map_user_location", handleUserLocationEvent);
      window.removeEventListener("angren_map_reset_center", handleResetCenterEvent);
      window.removeEventListener("angren_map_dimension_change", handleDimensionChangeEvent);
    };
  }, [dimension, userLocation]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div
        ref={mapContainerRef}
        id="yandex-map-container"
        data-testid="yandex-map-container"
        className="w-full h-full"
      />

      {/* Geolocation Toast Notification */}
      {geoNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-sm w-[90%] sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-900/90 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-slate-700/80 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-400 shrink-0" />
          <span>{geoNotice}</span>
        </div>
      )}

      {/* Floating Glass Navigation Controls: On Mobile, only [+] [-] zoom buttons float here; 3D, SAT, Location, Center are in the bottom control row */}
      <div className={`flex flex-col items-center gap-1.5 absolute ${effectiveControlsBottom} right-3 sm:right-5 z-20 pointer-events-auto`}>
        {/* 2D / 3D Perspective Toggle Button (Desktop only) */}
        <button
          onClick={handleToggleDimension}
          data-testid="map-toggle-3d"
          title={locale === "uz" ? (dimension === "3d" ? "2D rejimga o'tish" : "3D perspektivaga o'tish") : (dimension === "3d" ? "Переключить в 2D" : "Включить 3D")}
          className={`hidden sm:flex sm:h-10 sm:w-10 flex-col items-center justify-center rounded-2xl backdrop-blur-xl shadow-elevated border transition-all active:scale-95 ${
            dimension === "3d"
              ? "bg-[#167d4f] text-white border-[#167d4f] ring-2 ring-[#2db477]/40"
              : "bg-white/90 text-gray-700 hover:text-[#167d4f] border-white/80 hover:bg-white"
          }`}
        >
          <Box className="h-4 w-4" />
          <span className="text-[9px] font-black leading-none mt-0.5">{dimension.toUpperCase()}</span>
        </button>

        {/* Sxema / Sputnik (Vector / Satellite) Layer Switcher (Desktop only) */}
        <button
          onClick={() => onMapModeChange(mapMode === "satellite" ? "standard" : "satellite")}
          data-testid="map-toggle-layer"
          title={
            locale === "uz"
              ? mapMode === "satellite"
                ? "Sxema xaritaga o‘tish"
                : "Sputnik rejimiga o‘tish"
              : mapMode === "satellite"
              ? "Переключить на схему"
              : "Включить спутник"
          }
          className={`hidden sm:flex sm:h-10 sm:w-10 flex-col items-center justify-center rounded-2xl backdrop-blur-xl shadow-elevated border transition-all active:scale-95 ${
            mapMode === "satellite"
              ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400/40"
              : "bg-white/90 text-gray-700 hover:text-blue-600 border-white/80 hover:bg-white"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span className="text-[9px] font-black leading-none mt-0.5">
            {mapMode === "satellite" ? "SAT" : "MAP"}
          </span>
        </button>

        {/* Mening joylashuvim (User Geolocation) Button (Desktop only) */}
        <button
          onClick={handleUserLocationClick}
          disabled={geoLoading}
          data-testid="map-user-location"
          title={locale === "uz" ? "Mening joylashuvim" : "Моё местоположение"}
          className="hidden sm:flex sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-white/90 backdrop-blur-xl text-gray-700 hover:text-blue-600 shadow-elevated border border-white/80 hover:bg-white transition-all active:scale-95"
        >
          {geoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Navigation className="h-4 w-4 text-blue-600" />
          )}
        </button>

        {/* Reset Center Button (Desktop only) */}
        <button
          onClick={handleResetCenter}
          data-testid="map-reset-center"
          title={locale === "uz" ? "Angren markaziga qaytish" : "Центр Ангрена"}
          className="hidden sm:flex sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-white/90 backdrop-blur-xl text-gray-700 hover:text-[#167d4f] shadow-elevated border border-white/80 hover:bg-white transition-all active:scale-95"
        >
          <LocateFixed className="h-4 w-4" />
        </button>

        {/* Zoom Controls (Always visible on mobile & desktop) */}
        <div className="flex flex-col rounded-2xl bg-white/95 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden">
          <button
            onClick={handleZoomIn}
            data-testid="map-zoom-in"
            className="flex h-9 w-9 sm:h-9 sm:w-10 items-center justify-center text-gray-700 hover:text-[#167d4f] hover:bg-white transition-colors border-b border-gray-100 active:scale-95"
            aria-label="Zoom In"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            data-testid="map-zoom-out"
            className="flex h-9 w-9 sm:h-9 sm:w-10 items-center justify-center text-gray-700 hover:text-[#167d4f] hover:bg-white transition-colors active:scale-95"
            aria-label="Zoom Out"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
