"use client";

import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MapPin,
  Map as MapIcon,
  Layers,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Navigation,
  Compass,
} from "lucide-react";
import { ANGREN_CENTER, DEFAULT_ZOOM } from "../map/AngrenMap";

interface AdminLocationPickerProps {
  lat: number;
  lng: number;
  onChangeCoordinates: (coords: { lat: number; lng: number }) => void;
  polygonCoords: [number, number][];
  onChangePolygon: (coords: [number, number][]) => void;
  isLandOrYard?: boolean;
}

export function AdminLocationPicker({
  lat,
  lng,
  onChangeCoordinates,
  polygonCoords,
  onChangePolygon,
  isLandOrYard = false,
}: AdminLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const polygonMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard");
  const [isDrawingPolygon, setIsDrawingPolygon] = useState<boolean>(false);

  // Quick Angren district presets
  const presets = [
    { label: "Markaz", lat: 41.0167, lng: 70.1436 },
    { label: "5-mavze", lat: 41.0125, lng: 70.138 },
    { label: "6-mavze", lat: 41.019, lng: 70.132 },
    { label: "7-mavze", lat: 41.024, lng: 70.126 },
    { label: "Dukent", lat: 41.038, lng: 70.175 },
    { label: "Geolog", lat: 41.008, lng: 70.155 },
    { label: "Yangiobod", lat: 41.042, lng: 70.108 },
  ];

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

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
          attribution: '&copy; OpenStreetMap contributors',
        },
        "satellite-tiles": {
          type: "raster",
          tiles: [
            "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: '&copy; Esri Satellite',
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
        },
      ],
    };

    const initialCenter: [number, number] =
      lng && lat ? [lng, lat] : ANGREN_CENTER;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: 14.5,
      attributionControl: false,
    });

    // Create Draggable Pin Marker
    const markerEl = document.createElement("div");
    markerEl.className =
      "cursor-grab active:cursor-grabbing p-1 rounded-full bg-[#0d3431] text-white shadow-2xl border-2 border-white ring-4 ring-[#0d3431]/40 transition-transform hover:scale-110";
    markerEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;

    const marker = new maplibregl.Marker({
      element: markerEl,
      draggable: true,
      anchor: "bottom",
    })
      .setLngLat(initialCenter)
      .addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onChangeCoordinates({
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
      });
    });

    markerRef.current = marker;

    // Handle Map Clicks
    map.on("click", (e) => {
      const clickLng = Number(e.lngLat.lng.toFixed(6));
      const clickLat = Number(e.lngLat.lat.toFixed(6));

      if (isDrawingPolygon) {
        // Add vertex to polygon
        onChangePolygon([...polygonCoords, [clickLat, clickLng]]);
      } else {
        // Move main marker
        marker.setLngLat([clickLng, clickLat]);
        onChangeCoordinates({ lat: clickLat, lng: clickLng });
      }
    });

    // Setup GeoJSON Polygon Source & Layers
    map.on("load", () => {
      map.addSource("admin-polygon-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "admin-polygon-fill",
        type: "fill",
        source: "admin-polygon-source",
        paint: {
          "fill-color": "#0d3431",
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "admin-polygon-line",
        type: "line",
        source: "admin-polygon-source",
        paint: {
          "line-color": "#0d3431",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map layer on mapMode change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer("standard-layer") && map.getLayer("satellite-layer")) {
      map.setLayoutProperty(
        "standard-layer",
        "visibility",
        mapMode === "standard" ? "visible" : "none"
      );
      map.setLayoutProperty(
        "satellite-layer",
        "visibility",
        mapMode === "satellite" ? "visible" : "none"
      );
    }
  }, [mapMode]);

  // Sync marker when lat/lng props change externally
  useEffect(() => {
    if (markerRef.current && lat && lng) {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [lat, lng]);

  // Sync Polygon Layer on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource("admin-polygon-source") as maplibregl.GeoJSONSource;
    if (!source) return;

    // Clean old polygon vertex markers
    polygonMarkersRef.current.forEach((m) => m.remove());
    polygonMarkersRef.current = [];

    if (polygonCoords.length >= 3) {
      const ring = polygonCoords.map(([pLat, pLng]) => [pLng, pLat]);
      // Close ring
      ring.push(ring[0]);

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

    // Render vertex markers while drawing or inspecting
    if (isDrawingPolygon && polygonCoords.length > 0) {
      polygonCoords.forEach(([vLat, vLng], idx) => {
        const el = document.createElement("div");
        el.className =
          "flex h-5 w-5 items-center justify-center rounded-full bg-[#0d3431] text-white font-bold text-[10px] shadow-md border-2 border-white ring-2 ring-[#8cb599]";
        el.innerText = `${idx + 1}`;

        const m = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([vLng, vLat])
          .addTo(map);

        polygonMarkersRef.current.push(m);
      });
    }
  }, [polygonCoords, isDrawingPolygon]);

  const handleFlyToPreset = (pLat: number, pLng: number) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [pLng, pLat],
      zoom: 15,
      duration: 600,
    });
    markerRef.current?.setLngLat([pLng, pLat]);
    onChangeCoordinates({ lat: pLat, lng: pLng });
  };

  const handleUndoVertex = () => {
    if (polygonCoords.length > 0) {
      onChangePolygon(polygonCoords.slice(0, -1));
    }
  };

  const handleClearPolygon = () => {
    onChangePolygon([]);
  };

  return (
    <div className="space-y-3">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-100 border border-slate-200">
        {/* District Quick Selectors */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap mr-1">
            Angren hududlari:
          </span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleFlyToPreset(preset.lat, preset.lng)}
              className="px-2.5 py-1 rounded-xl bg-white hover:bg-[#d9eedb]/40 hover:text-[#0d3431] text-[11px] font-bold text-slate-700 border border-slate-200/80 shadow-sm transition-colors whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Satellite Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMapMode("standard")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              mapMode === "standard"
                ? "bg-[#0d3431] text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MapIcon className="h-3 w-3" />
            <span>Sxema</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode("satellite")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              mapMode === "satellite"
                ? "bg-[#0d3431] text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Sun’iy yo‘ldosh</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner">
        <div ref={containerRef} className="w-full h-full" />

        {/* Marker Drag Hint Overlay */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow-md border border-white/80 text-[11px] font-bold text-slate-700">
            <MapPin className="h-3.5 w-3.5 text-[#0d3431]" />
            <span>
              {isDrawingPolygon
                ? "Xaritada bosing: nuqta qo‘shiladi"
                : "Belgini suring yoki xaritani bosing"}
            </span>
          </div>
        </div>

        {/* Polygon Toolbar overlay for houses/land */}
        {isLandOrYard && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsDrawingPolygon(!isDrawingPolygon)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-elevated transition-all ${
                isDrawingPolygon
                  ? "bg-amber-600 text-white ring-2 ring-amber-300"
                  : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>
                {isDrawingPolygon ? "Chizishni to‘xtatish" : "Polygon chizish"}
              </span>
              {polygonCoords.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#d9eedb] text-[#0d3431] text-[10px] font-extrabold">
                  {polygonCoords.length} nuqta
                </span>
              )}
            </button>

            {isDrawingPolygon && (
              <>
                <button
                  type="button"
                  onClick={handleUndoVertex}
                  disabled={polygonCoords.length === 0}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-md disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Bekor qilish</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearPolygon}
                  disabled={polygonCoords.length === 0}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-red-50 text-red-600 text-xs font-bold border border-slate-200 shadow-md disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Tozalash</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Coordinates Readout & Manual Inputs */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <label className="text-[11px] font-bold text-slate-500">
            Latitude (Kenglik):
          </label>
          <div className="font-mono font-black text-slate-800 text-xs sm:text-sm">
            {lat.toFixed(6)}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <label className="text-[11px] font-bold text-slate-500">
            Longitude (Uzunlik):
          </label>
          <div className="font-mono font-black text-slate-800 text-xs sm:text-sm">
            {lng.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}
