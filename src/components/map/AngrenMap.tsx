"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Property } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { LocateFixed, Plus, Minus } from "lucide-react";

interface AngrenMapProps {
  properties: Property[];
  selectedProperty: Property | null;
  onSelectProperty: (property: Property | null) => void;
  mapMode: "standard" | "satellite";
  onMapModeChange: (mode: "standard" | "satellite") => void;
  className?: string;
  focusDistrict?: string | null;
}

// Angren, Tashkent Region center coordinates
export const ANGREN_CENTER: [number, number] = [70.1436, 41.0167];
export const DEFAULT_ZOOM = 13.3;
const CLUSTER_ZOOM_THRESHOLD = 13.1;

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

  const { locale, t } = useLanguage();
  const { currency } = useCurrency();

  // Helper to format short price on marker pill
  const formatMarkerPrice = (priceUzs: number, isSale: boolean): string => {
    if (currency === "USD") {
      const usd = Math.round(priceUzs / 12800);
      if (usd >= 1000) {
        return isSale ? `$${(usd / 1000).toFixed(1)}k` : `$${usd}/oy`;
      }
      return isSale ? `$${usd}` : `$${usd}/oy`;
    }

    // UZS
    const mln = priceUzs / 1000000;
    if (mln >= 1) {
      const formattedMln = Number.isInteger(mln) ? mln.toString() : mln.toFixed(1);
      return isSale ? `${formattedMln} mln UZS` : `${formattedMln} mln / oy`;
    }
    const k = Math.round(priceUzs / 1000);
    return `${k} ming`;
  };

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

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
          maxzoom: 19,
          layout: {
            visibility: mapMode === "standard" ? "visible" : "none",
          },
          paint: {
            "raster-saturation": -0.55,
            "raster-contrast": 0.08,
            "raster-brightness-min": 0.05,
            "raster-brightness-max": 0.98,
          },
        },
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite-tiles",
          minzoom: 0,
          maxzoom: 19,
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
      center: ANGREN_CENTER,
      zoom: DEFAULT_ZOOM,
      maxBounds: [
        [69.95, 40.88], // Southwest
        [70.35, 41.16], // Northeast
      ],
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    // Track zoom level for clustering
    map.on("zoomend", () => {
      setCurrentZoom(map.getZoom());
    });

    // Clicking map background clears selection
    map.on("click", (e: maplibregl.MapMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (!target.closest(".property-marker-element") && !target.closest(".cluster-marker-element")) {
        onSelectProperty(null);
      }
    });

    // Setup Polygon source and layer when style loaded
    map.on("load", () => {
      // Sync initial visibility state
      const isStandard = mapMode === "standard";
      if (map.getLayer("standard-layer")) {
        map.setLayoutProperty("standard-layer", "visibility", isStandard ? "visible" : "none");
      }
      if (map.getLayer("satellite-layer")) {
        map.setLayoutProperty("satellite-layer", "visibility", isStandard ? "none" : "visible");
      }

      if (!map.getSource("property-polygon-source")) {
        map.addSource("property-polygon-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "property-polygon-fill",
          type: "fill",
          source: "property-polygon-source",
          paint: {
            "fill-color": "#16543C",
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "property-polygon-outline",
          type: "line",
          source: "property-polygon-source",
          paint: {
            "line-color": "#16543C",
            "line-width": 2.5,
          },
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Seamlessly toggle between Standard and Satellite
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      try {
        const isStandard = mapMode === "standard";
        if (map.getLayer("standard-layer")) {
          map.setLayoutProperty("standard-layer", "visibility", isStandard ? "visible" : "none");
        }
        if (map.getLayer("satellite-layer")) {
          map.setLayoutProperty("satellite-layer", "visibility", isStandard ? "none" : "visible");
        }
      } catch (err) {
        console.warn("[AngrenMap] Error toggling layer visibility:", err);
      }
    };

    if (map.getLayer("standard-layer") && map.getLayer("satellite-layer")) {
      applyVisibility();
    } else {
      map.once("styledata", applyVisibility);
      map.once("load", applyVisibility);
    }
  }, [mapMode]);

  // Update Polygon Geometry on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("property-polygon-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    if (selectedProperty?.polygon && selectedProperty.polygon.length >= 3) {
      // Convert [lat, lng] to GeoJSON [lng, lat]
      const ring = selectedProperty.polygon.map(([lat, lng]) => [lng, lat]);
      // Ensure closed loop
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }

      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [ring],
            },
            properties: {},
          },
        ],
      });
    } else {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, [selectedProperty]);

  // Calculate Clusters or Individual Markers
  const { clusters, individualProps } = useMemo(() => {
    const shouldCluster = currentZoom < CLUSTER_ZOOM_THRESHOLD;
    if (!shouldCluster || properties.length <= 4) {
      return { clusters: [], individualProps: properties };
    }

    // Grid clustering based on coordinate proximity
    const clusterMap: { [key: string]: Property[] } = {};
    const clusterDist = 0.012; // grid threshold

    properties.forEach((prop) => {
      const latGrid = Math.round(prop.coordinates.lat / clusterDist) * clusterDist;
      const lngGrid = Math.round(prop.coordinates.lng / clusterDist) * clusterDist;
      const key = `${latGrid.toFixed(4)}_${lngGrid.toFixed(4)}`;

      if (!clusterMap[key]) clusterMap[key] = [];
      clusterMap[key].push(prop);
    });

    const clustersList: { id: string; lat: number; lng: number; items: Property[] }[] = [];
    const singles: Property[] = [];

    Object.entries(clusterMap).forEach(([k, items]) => {
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

  // Render Markers on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // 1. Render Cluster Badges
    clusters.forEach((cluster) => {
      const el = document.createElement("div");
      el.className =
        "cluster-marker-element cursor-pointer select-none transition-transform duration-200 hover:scale-110 active:scale-95";

      el.innerHTML = `
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16543C] text-white font-black text-xs shadow-xl border-2 border-white/95 backdrop-blur-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
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

    // 2. Render Individual Property Price Markers
    individualProps.forEach((property) => {
      const isSelected = selectedProperty?.id === property.id;
      const isSale = property.transaction_type === "sale";
      const priceText = formatMarkerPrice(property.price_uzs, isSale);

      const el = document.createElement("div");
      el.className = `property-marker-element group cursor-pointer transition-all duration-300 ease-out select-none ${
        isSelected ? "z-30 scale-110" : "z-10 hover:scale-105"
      }`;

      const container = document.createElement("div");
      container.className = `flex items-center gap-1.5 p-1 pr-3 rounded-full font-bold text-xs tracking-tight shadow-elevated transition-all backdrop-blur-md ${
        isSelected
          ? "bg-[#0E3324] text-white ring-4 ring-[#16543C]/50 border-2 border-white scale-105 shadow-2xl"
          : isSale
          ? "bg-[#16543C] text-white hover:bg-[#113F2D] border border-white/90 shadow-md"
          : "bg-emerald-950 text-emerald-100 hover:bg-emerald-900 border border-emerald-400/80 shadow-md"
      }`;

      // Icon Circle
      const iconCircle = document.createElement("div");
      iconCircle.className = `flex h-6 w-6 items-center justify-center rounded-full ${
        isSelected
          ? "bg-emerald-400 text-[#0E3324]"
          : isSale
          ? "bg-white/20 text-white"
          : "bg-emerald-400/20 text-emerald-300"
      }`;
      iconCircle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

      // Price Label
      const label = document.createElement("span");
      label.className = "whitespace-nowrap font-extrabold text-[11px] sm:text-xs";
      label.innerText = priceText;

      container.appendChild(iconCircle);
      container.appendChild(label);
      el.appendChild(container);

      // Pin Pointer Tip
      const tip = document.createElement("div");
      tip.className = `w-2.5 h-2.5 mx-auto -mt-1 rotate-45 border-r border-b ${
        isSelected
          ? "bg-[#0E3324] border-[#0E3324]"
          : isSale
          ? "bg-[#16543C] border-[#16543C]"
          : "bg-emerald-950 border-emerald-950"
      }`;
      el.appendChild(tip);

      // Click event
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
  }, [clusters, individualProps, selectedProperty, currency, locale]);

  // Center on selected property
  useEffect(() => {
    if (!selectedProperty || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [selectedProperty.coordinates.lng, selectedProperty.coordinates.lat],
      zoom: 14.8,
      duration: 600,
      essential: true,
    });
  }, [selectedProperty]);

  // Focus on district when selected
  useEffect(() => {
    if (!focusDistrict || focusDistrict === "all" || !mapRef.current) return;
    const districtCoords: Record<string, [number, number]> = {
      "markaz": [70.1436, 41.0167],
      "5-mavze": [70.1380, 41.0125],
      "6-mavze": [70.1320, 41.0190],
      "7-mavze": [70.1260, 41.0240],
      "dukent": [70.1750, 41.0380],
      "geolog": [70.1550, 41.0080],
      "yangiobod": [70.1080, 41.0420],
    };

    const key = Object.keys(districtCoords).find((k) =>
      focusDistrict.toLowerCase().includes(k)
    );
    if (key && districtCoords[key]) {
      mapRef.current.flyTo({
        center: districtCoords[key],
        zoom: 14.2,
        duration: 800,
        essential: true,
      });
    }
  }, [focusDistrict]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetCenter = () => {
    mapRef.current?.flyTo({
      center: ANGREN_CENTER,
      zoom: DEFAULT_ZOOM,
      duration: 800,
    });
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Glass Navigation Controls: [ Reset Center ], [ + ], [ - ] */}
      <div className="hidden sm:flex flex-col items-center gap-1.5 absolute bottom-6 right-6 z-20 pointer-events-auto">
        <button
          onClick={handleResetCenter}
          title={locale === "uz" ? "Angren markaziga qaytish" : "Центр Ангрена"}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 backdrop-blur-xl text-gray-700 hover:text-[#16543C] shadow-elevated border border-white/80 hover:bg-white transition-all active:scale-95"
        >
          <LocateFixed className="h-4 w-4" />
        </button>

        <div className="flex flex-col rounded-2xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="flex h-9 w-10 items-center justify-center text-gray-700 hover:text-[#16543C] hover:bg-white transition-colors border-b border-gray-100 active:scale-95"
            aria-label="Zoom In"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
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
