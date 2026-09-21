"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  X,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Layers,
  Save,
  Building2,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import { HududItem } from "@/lib/types";
import { calculatePolygonCentroid } from "@/lib/hududService";
import { useLanguage } from "@/context/LanguageContext";

interface HududPolygonDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHududCreated: (hudud: HududItem) => void;
  editingHudud?: HududItem | null;
}

export function HududPolygonDrawerModal({
  isOpen,
  onClose,
  onHududCreated,
  editingHudud = null,
}: HududPolygonDrawerModalProps) {
  const { locale } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize editing state
  useEffect(() => {
    if (editingHudud) {
      setNameUz(editingHudud.name_uz || "");
      setNameRu(editingHudud.name_ru || "");
      if (Array.isArray(editingHudud.coordinates) && editingHudud.coordinates.length >= 3) {
        const pts = [...editingHudud.coordinates];
        if (
          pts.length > 3 &&
          pts[0][0] === pts[pts.length - 1][0] &&
          pts[0][1] === pts[pts.length - 1][1]
        ) {
          pts.pop();
        }
        setPoints(pts);
        setIsClosed(true);
      } else {
        setPoints([]);
        setIsClosed(false);
      }
    } else {
      setNameUz("");
      setNameRu("");
      setPoints([]);
      setIsClosed(false);
    }
    setErrorMsg(null);
  }, [editingHudud, isOpen]);

  // Redraw polygon layer on map
  const updateMapLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Remove existing
    if (map.getLayer("drawn-polygon-fill")) map.removeLayer("drawn-polygon-fill");
    if (map.getLayer("drawn-polygon-outline")) map.removeLayer("drawn-polygon-outline");
    if (map.getSource("drawn-polygon-source")) map.removeSource("drawn-polygon-source");

    if (points.length < 2) return;

    // If closed or >= 3 points, form a closed coordinate loop for polygon
    const closed =
      isClosed || points.length >= 3
        ? [
            ...points.map(([lat, lng]) => [lng, lat]),
            [points[0][1], points[0][0]],
          ]
        : points.map(([lat, lng]) => [lng, lat]);

    const geojsonData: any = {
      type: "Feature",
      geometry:
        points.length >= 3
          ? {
              type: "Polygon",
              coordinates: [closed],
            }
          : {
              type: "LineString",
              coordinates: closed,
            },
      properties: {},
    };

    map.addSource("drawn-polygon-source", {
      type: "geojson",
      data: geojsonData,
    });

    if (points.length >= 3) {
      map.addLayer({
        id: "drawn-polygon-fill",
        type: "fill",
        source: "drawn-polygon-source",
        paint: {
          "fill-color": "#0c2e1f",
          "fill-opacity": 0.25,
        },
      });
    }

    map.addLayer({
      id: "drawn-polygon-outline",
      type: "line",
      source: "drawn-polygon-source",
      paint: {
        "line-color": "#0c2e1f",
        "line-width": 3,
        "line-dasharray": isClosed ? [1] : [2, 2],
      },
    });
  }, [points, isClosed]);

  // Update vertex markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Create markers for each vertex
    points.forEach(([lat, lng], idx) => {
      const el = document.createElement("div");
      el.className =
        "w-6 h-6 rounded-full bg-[#0c2e1f] border-2 border-white text-white flex items-center justify-center text-[10px] font-black shadow-md cursor-pointer hover:scale-110 transition-transform";
      el.innerText = `${idx + 1}`;

      // Clicking first vertex when >= 3 points closes polygon
      if (idx === 0 && points.length >= 3 && !isClosed) {
        el.title = locale === "uz" ? "Polygonni yopish" : "Замкнуть полигон";
        el.onclick = (e) => {
          e.stopPropagation();
          setIsClosed(true);
        };
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    updateMapLayers();
  }, [points, isClosed, updateMapLayers, locale]);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !containerRef.current || mapRef.current) return;

    const standardStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap",
        },
      },
      layers: [{ id: "osm-layer", type: "raster", source: "osm" }],
    };

    const initialCenter: [number, number] =
      points.length > 0 ? [points[0][1], points[0][0]] : [70.1436, 41.0167];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: standardStyle,
      center: initialCenter,
      zoom: points.length > 0 ? 14 : 13.5,
    });

    mapRef.current = map;

    map.on("load", () => {
      map.resize();
      if (points.length >= 3) {
        updateMapLayers();
      }
    });

    map.on("click", (e) => {
      if (isClosed) return;
      const newPt: [number, number] = [
        Number(e.lngLat.lat.toFixed(6)),
        Number(e.lngLat.lng.toFixed(6)),
      ];
      setPoints((prev) => [...prev, newPt]);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [isOpen]);

  // Handle map style switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (mapMode === "satellite") {
      const satStyle: maplibregl.StyleSpecification = {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "&copy; Esri",
          },
        },
        layers: [{ id: "sat-layer", type: "raster", source: "satellite" }],
      };
      map.setStyle(satStyle);
    } else {
      const osmStyle: maplibregl.StyleSpecification = {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
          },
        },
        layers: [{ id: "osm-layer", type: "raster", source: "osm" }],
      };
      map.setStyle(osmStyle);
    }

    map.once("styledata", () => {
      updateMapLayers();
    });
  }, [mapMode, updateMapLayers]);

  const handleUndo = () => {
    if (isClosed) {
      setIsClosed(false);
      return;
    }
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleReset = () => {
    setPoints([]);
    setIsClosed(false);
    setErrorMsg(null);
  };

  const handleSave = async () => {
    if (!nameUz.trim()) {
      setErrorMsg(
        locale === "uz"
          ? "Iltimos, hudud nomini kiriting (masalan: 4-mavze)."
          : "Пожалуйста, введите название района (например: 4-массив)."
      );
      return;
    }
    if (points.length < 3) {
      setErrorMsg(
        locale === "uz"
          ? "Iltimos, xaritada kamida 3 ta nuqta belgilab poligon chizing."
          : "Пожалуйста, отметьте на карте минимум 3 точки для полигона."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const closedCoords: [number, number][] = [...points];
      if (
        closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
        closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]
      ) {
        closedCoords.push(closedCoords[0]);
      }

      const method = editingHudud ? "PUT" : "POST";
      const payload: any = {
        name_uz: nameUz.trim(),
        name_ru: nameRu.trim() || nameUz.trim(),
        coordinates: closedCoords,
      };
      if (editingHudud) {
        payload.id = editingHudud.id;
      }

      const res = await fetch("/api/admin/hududs", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            (locale === "uz"
              ? "Hududni saqlashda xatolik yuz berdi."
              : "Произошла ошибка при сохранении района.")
        );
      }

      onHududCreated(data.hudud);
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          (locale === "uz" ? "Xatolik yuz berdi" : "Произошла ошибка")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e5f0eb]/50 text-[#0c2e1f]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingHudud
                    ? locale === "uz"
                      ? "Hududni tahrirlash"
                      : "Редактировать район"
                    : locale === "uz"
                    ? "Yangi hudud yaratish va poligon chizish"
                    : "Создать новый район и нарисовать полигон"}
                </h3>
                <p className="text-xs text-slate-500">
                  {locale === "uz"
                    ? "Xaritada nuqtalarni bosib hudud chegaralarini chizing"
                    : "Кликайте по карте, чтобы нарисовать границы района"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left/Top: Interactive Map */}
            <div className="relative flex-1 h-72 md:h-auto min-h-[320px]">
              <div ref={containerRef} className="w-full h-full" />

              {/* Map controls */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={() => setMapMode(mapMode === "standard" ? "satellite" : "standard")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-white transition-colors"
                >
                  <Layers className="h-3.5 w-3.5 text-[#0c2e1f]" />
                  <span>
                    {mapMode === "standard"
                      ? locale === "uz"
                        ? "Sun’iy yo‘ldosh"
                        : "Спутник"
                      : locale === "uz"
                      ? "Sxema"
                      : "Схема"}
                  </span>
                </button>
              </div>

              {/* Draw instructions badge */}
              <div className="absolute bottom-3 left-3 z-10 bg-slate-900/85 text-white backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-lg">
                <span className="h-2 w-2 rounded-full bg-[#339e71] animate-pulse" />
                <span>
                  {points.length === 0
                    ? locale === "uz"
                      ? "Xarita ustiga bosib birinchi nuqtani belgilang"
                      : "Кликните по карте, чтобы отметить первую точку"
                    : isClosed
                    ? locale === "uz"
                      ? "Poligon yopildi. Nomini kiritib saqlang."
                      : "Полигон замкнут. Введите название и сохраните."
                    : points.length >= 3
                    ? locale === "uz"
                      ? "Yana nuqta qo‘shing yoki 1-nuqtani bosib yoping"
                      : "Добавьте еще точку или кликните 1-ю для замыкания"
                    : `${points.length} ` +
                      (locale === "uz"
                        ? "ta nuqta belgilandi (kamida 3 ta kerak)"
                        : "точек отмечено (нужно минимум 3)")}
                </span>
              </div>
            </div>

            {/* Right/Bottom: Inputs & Actions */}
            <div className="w-full md:w-80 p-5 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === "uz" ? "Hudud nomi (O‘zbekcha) *" : "Название района (Узбекский) *"}
                  </label>
                  <input
                    type="text"
                    value={nameUz}
                    onChange={(e) => setNameUz(e.target.value)}
                    placeholder={locale === "uz" ? "Masalan: 4-mavze" : "Например: 4-массив"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#19573c]/20 focus:border-[#19573c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === "uz" ? "Hudud nomi (Ruscha)" : "Название района (Русский)"}
                  </label>
                  <input
                    type="text"
                    value={nameRu}
                    onChange={(e) => setNameRu(e.target.value)}
                    placeholder={locale === "uz" ? "Masalan: 4-массив" : "Например: 4-массив"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#19573c]/20 focus:border-[#19573c]"
                  />
                </div>

                {/* Points count & Centroid info */}
                <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{locale === "uz" ? "Nuqtalar soni:" : "Количество точек:"}</span>
                    <span className="font-extrabold text-[#0c2e1f]">
                      {points.length} {locale === "uz" ? "ta" : "ед."}
                    </span>
                  </div>
                  {points.length >= 3 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{locale === "uz" ? "Markaz (Centroid):" : "Центр (Центроид):"}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {calculatePolygonCentroid(points).lat},{" "}
                        {calculatePolygonCentroid(points).lng}
                      </span>
                    </div>
                  )}
                </div>

                {/* Drawing Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={points.length === 0}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold transition-all"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Qaytarish" : "Отменить"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={points.length === 0}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-bold transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{locale === "uz" ? "Tozalash" : "Очистить"}</span>
                  </button>
                </div>

                {points.length >= 3 && !isClosed && (
                  <button
                    type="button"
                    onClick={() => setIsClosed(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#e5f0eb]/40 border border-[#339e71]/60 text-[#0c2e1f] text-xs font-extrabold hover:bg-[#e5f0eb]/70 transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {locale === "uz"
                        ? "Polygonni yakunlash (yopish)"
                        : "Замкнуть полигон"}
                    </span>
                  </button>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Submit / Save */}
              <div className="pt-4 border-t border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting || points.length < 3 || !nameUz.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#0c2e1f] hover:bg-[#19573c] disabled:opacity-50 text-white text-xs font-extrabold shadow-md active:scale-[0.98] transition-all"
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {isSubmitting
                      ? locale === "uz"
                        ? "Saqlanmoqda..."
                        : "Сохранение..."
                      : editingHudud
                      ? locale === "uz"
                        ? "O‘zgarishlarni saqlash"
                        : "Сохранить изменения"
                      : locale === "uz"
                      ? "Hududni saqlash"
                      : "Сохранить район"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
