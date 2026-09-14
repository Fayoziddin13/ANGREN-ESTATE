"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { LocateFixed, Plus, Minus, Box } from "lucide-react";
import {
  getMapCamera,
  saveMapCamera,
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
}: AngrenMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibregl.Marker }>({});
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);
  const [dimension, setDimension] = useState<MapDimension>("3d");
  const [isMapReady, setIsMapReady] = useState(false);

  const { locale, t } = useLanguage();
  const { currency, exchangeRate } = useCurrency();

  // Helper to format short price on marker pill
  const formatMarkerPrice = useCallback(
    (priceUzs: number, isSale: boolean): string => {
      if (currency === "USD") {
        const usd = Math.round(priceUzs / exchangeRate);
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
    [currency, exchangeRate]
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
            "fill-color": "#16543C",
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "property-polygon-line",
          type: "line",
          source: "property-polygon",
          paint: {
            "line-color": "#16543C",
            "line-width": 2.5,
            "line-opacity": 0.9,
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
        <div class="angren-cluster-inner flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16543C] text-white font-extrabold text-xs shadow-xl border-2 border-white/95 backdrop-blur-md">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#34D399; box-shadow:0 0 6px #34D399;"></span>
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
          ? "#0E3324"
          : "#1E3A8A"
        : isSale
        ? "#16543C"
        : "#1D4ED8";

      const ringBorder = isSelected
        ? isSale
          ? "ring-4 ring-[#34D399]/60 border-2 border-[#34D399]"
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

  // 7. Focus on district when selected
  useEffect(() => {
    if (!focusDistrict || focusDistrict === "all" || !mapRef.current) return;
    const districtCoords: Record<string, [number, number]> = {
      markaz: [70.1436, 41.0167],
      "5-mavze": [70.138, 41.0125],
      "6-mavze": [70.132, 41.019],
      "7-mavze": [70.126, 41.024],
      dukent: [70.175, 41.038],
      geolog: [70.155, 41.008],
      yangiobod: [70.108, 41.042],
    };

    const key = Object.keys(districtCoords).find((k) =>
      focusDistrict.toLowerCase().includes(k)
    );
    if (key && districtCoords[key]) {
      mapRef.current.flyTo({
        center: districtCoords[key],
        zoom: 14.2,
        duration: 700,
        essential: true,
      });
    }
  }, [focusDistrict]);

  // 8. Navigation & 2D/3D Handlers
  const handleToggleDimension = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextDim: MapDimension = dimension === "3d" ? "2d" : "3d";
    const targetPitch = nextDim === "3d" ? DEFAULT_MAP_PITCH_3D : DEFAULT_MAP_PITCH_2D;
    setDimension(nextDim);
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

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div
        ref={mapContainerRef}
        id="yandex-map-container"
        data-testid="yandex-map-container"
        className="w-full h-full"
      />

      {/* Floating Glass Navigation Controls: [ 3D / 2D ], [ Reset Center ], [ + ], [ - ] */}
      <div className="hidden sm:flex flex-col items-center gap-1.5 absolute bottom-8 right-5 z-20 pointer-events-auto">
        {/* 2D / 3D Perspective Toggle Button */}
        <button
          onClick={handleToggleDimension}
          data-testid="map-toggle-3d"
          title={locale === "uz" ? (dimension === "3d" ? "2D rejimga o'tish" : "3D perspektivaga o'tish") : (dimension === "3d" ? "Переключить в 2D" : "Включить 3D")}
          className={`flex h-10 w-10 flex-col items-center justify-center rounded-2xl backdrop-blur-xl shadow-elevated border transition-all active:scale-95 ${
            dimension === "3d"
              ? "bg-[#16543C] text-white border-[#16543C] ring-2 ring-[#34D399]/40"
              : "bg-white/90 text-gray-700 hover:text-[#16543C] border-white/80 hover:bg-white"
          }`}
        >
          <Box className="h-4 w-4" />
          <span className="text-[9px] font-black leading-none mt-0.5">{dimension.toUpperCase()}</span>
        </button>

        {/* Reset Center Button */}
        <button
          onClick={handleResetCenter}
          data-testid="map-reset-center"
          title={locale === "uz" ? "Angren markaziga qaytish" : "Центр Ангрена"}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 backdrop-blur-xl text-gray-700 hover:text-[#16543C] shadow-elevated border border-white/80 hover:bg-white transition-all active:scale-95"
        >
          <LocateFixed className="h-4 w-4" />
        </button>

        {/* Zoom Controls */}
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
