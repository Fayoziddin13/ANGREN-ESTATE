"use client";

import React, { useState, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Compass,
  MapPin,
  Layers,
  Search,
  CheckCircle,
  AlertCircle,
  Plus,
  Move,
  Trash2,
  Save,
  Crosshair,
  Filter,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useProperties } from "@/lib/propertyStore";
import { Property, PropertyStatus } from "@/lib/types";

const ANGREN_CENTER: [number, number] = [70.1436, 41.0167];

export default function AdminMapManagementPage() {
  const { locale } = useLanguage();
  const { properties, updateProperty } = useProperties();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: maplibregl.Marker }>({});

  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit location state
  const [editLat, setEditLat] = useState<number>(41.0167);
  const [editLng, setEditLng] = useState<number>(70.1436);
  const [isEditMode, setIsEditMode] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "&copy; Esri World Imagery",
          },
        },
        layers: [
          {
            id: "osm-layer",
            type: "raster",
            source: "osm",
            layout: { visibility: "visible" },
          },
          {
            id: "satellite-layer",
            type: "raster",
            source: "satellite",
            layout: { visibility: "none" },
          },
        ],
      },
      center: ANGREN_CENTER,
      zoom: 13.2,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      const isStandard = mapMode === "standard";
      if (map.getLayer("osm-layer")) {
        map.setLayoutProperty("osm-layer", "visibility", isStandard ? "visible" : "none");
      }
      if (map.getLayer("satellite-layer")) {
        map.setLayoutProperty("satellite-layer", "visibility", isStandard ? "none" : "visible");
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Switch Map Style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      try {
        const isStandard = mapMode === "standard";
        if (map.getLayer("osm-layer")) {
          map.setLayoutProperty("osm-layer", "visibility", isStandard ? "visible" : "none");
        }
        if (map.getLayer("satellite-layer")) {
          map.setLayoutProperty("satellite-layer", "visibility", isStandard ? "none" : "visible");
        }
      } catch (err) {
        console.warn("[AdminMap] Error toggling layer visibility:", err);
      }
    };

    if (map.getLayer("osm-layer") && map.getLayer("satellite-layer")) {
      applyVisibility();
    } else {
      map.once("styledata", applyVisibility);
      map.once("load", applyVisibility);
    }
  }, [mapMode]);

  // 3. Render Property Markers with Status Colors
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    properties.forEach((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return;

      const el = document.createElement("div");
      el.className = "cursor-pointer select-none transition-transform hover:scale-110";

      let bgColor = "#16543C"; // published
      if (p.status === "draft") bgColor = "#D97706";
      else if (p.status === "sold") bgColor = "#DC2626";
      else if (p.status === "rented") bgColor = "#2563EB";
      else if (p.status === "archived") bgColor = "#64748B";

      el.innerHTML = `
        <div style="background-color: ${bgColor};" class="text-white px-2.5 py-1 rounded-full shadow-lg border-2 border-white text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap">
          <span class="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
          <span>${p.price_usd ? `$${p.price_usd.toLocaleString()}` : `${p.title_uz.slice(0, 12)}...`}</span>
        </div>
      `;

      el.addEventListener("click", () => {
        setSelectedProperty(p);
        setEditLat(p.coordinates.lat);
        setEditLng(p.coordinates.lng);
        setIsEditMode(false);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.coordinates.lng, p.coordinates.lat])
        .addTo(map);

      markersRef.current[p.id] = marker;
    });
  }, [properties, statusFilter]);

  // Handle Location Update
  const handleSaveLocation = async () => {
    if (!selectedProperty) return;
    await updateProperty(selectedProperty.id, {
      coordinates: { lat: editLat, lng: editLng },
    });
    showToast("Obyekt koordinatalari muvaffaqiyatli saqlandi!");
    setIsEditMode(false);
  };

  const recenterAngren = () => {
    mapRef.current?.flyTo({ center: ANGREN_CENTER, zoom: 13.2 });
  };

  const filtered = properties.filter((p) => {
    const matchSearch =
      p.title_uz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address_uz.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="h-[calc(100vh-65px)] flex flex-col lg:flex-row overflow-hidden relative">
      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0E3324] text-white px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-emerald-500/40 animate-bounce">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Map Canvas (Left 8 cols) */}
      <div className="flex-1 h-full relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Map Controls */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          {/* Schematic / Satellite Switcher */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-1 shadow-elevated border border-slate-200 flex items-center gap-1 text-xs font-bold">
            <button
              onClick={() => setMapMode("standard")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                mapMode === "standard"
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Sxema (Map)
            </button>
            <button
              onClick={() => setMapMode("satellite")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                mapMode === "satellite"
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Recenter Button */}
          <button
            onClick={recenterAngren}
            className="p-2.5 rounded-2xl bg-white/95 backdrop-blur-md text-slate-700 shadow-elevated border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Angren markaziga qaytish"
          >
            <Crosshair className="h-4 w-4 text-[#16543C]" />
          </button>
        </div>

        {/* Legend Overlay at Bottom Left */}
        <div className="absolute bottom-6 left-4 z-10 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-elevated border border-slate-200 text-[11px] font-bold space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Statuslar</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-[#16543C]" /> Nashr qilingan
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" /> Qoralama
            </span>
            <span className="flex items-center gap-1.5 text-red-700">
              <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" /> Sotildi
            </span>
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> Ijara
            </span>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Property Selector & Coordinate Editor (4 cols) */}
      <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full z-10 shadow-lg">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#16543C]" />
              <span>Xarita Boshqaruvi</span>
            </h2>
            <span className="text-xs font-bold text-slate-500">
              {filtered.length} ta obyekt
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Obyektni qidirish..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-[#16543C]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
            {["all", "published", "draft", "sold", "rented"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded-lg capitalize whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-[#16543C] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Property Details & Location Editor */}
        {selectedProperty ? (
          <div className="p-4 bg-emerald-50/40 border-b border-emerald-200/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Tanlangan Obyekt
              </span>
              <button
                onClick={() => setSelectedProperty(null)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-700"
              >
                Yopish
              </button>
            </div>

            <h3 className="font-extrabold text-xs text-slate-900 truncate">
              {selectedProperty.title_uz}
            </h3>
            <p className="text-[11px] text-slate-500">{selectedProperty.address_uz}</p>

            {/* Coordinates editor */}
            <div className="space-y-2 pt-2 border-t border-emerald-200/50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#16543C]" />
                  <span>Koordinatalar</span>
                </span>
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="text-[11px] font-bold text-[#16543C] hover:underline"
                >
                  {isEditMode ? "Bekor qilish" : "Tahrirlash"}
                </button>
              </div>

              {isEditMode ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500">Lat</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editLat}
                        onChange={(e) => setEditLat(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Lng</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editLng}
                        onChange={(e) => setEditLng(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded-lg border border-slate-300 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveLocation}
                    className="w-full py-2 rounded-xl bg-[#16543C] text-white font-bold text-xs hover:bg-[#0E3324] transition-colors"
                  >
                    Saqlash
                  </button>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                  {selectedProperty.coordinates.lat.toFixed(5)}, {selectedProperty.coordinates.lng.toFixed(5)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 text-center text-xs text-slate-400">
            Xaritadagi obyektni bosing yoki quyidagi ro‘yxatdan tanlang
          </div>
        )}

        {/* Scrollable Property List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProperty(p);
                setEditLat(p.coordinates.lat);
                setEditLng(p.coordinates.lng);
                mapRef.current?.flyTo({
                  center: [p.coordinates.lng, p.coordinates.lat],
                  zoom: 15,
                });
              }}
              className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedProperty?.id === p.id ? "bg-emerald-50/70 border-l-4 border-[#16543C]" : ""
              }`}
            >
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-slate-800 truncate">{p.title_uz}</h4>
                <p className="text-[11px] text-slate-400 truncate">{p.address_uz}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-black text-[#16543C]">
                  ${p.price_usd?.toLocaleString()}
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
