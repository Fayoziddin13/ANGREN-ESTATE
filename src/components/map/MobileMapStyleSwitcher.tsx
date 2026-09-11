"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Map, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface MobileMapStyleSwitcherProps {
  mapMode: "standard" | "satellite";
  onMapModeChange: (mode: "standard" | "satellite") => void;
  className?: string;
}

export function MobileMapStyleSwitcher({
  mapMode,
  onMapModeChange,
  className = "",
}: MobileMapStyleSwitcherProps) {
  const { locale, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when tapping outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (mode: "standard" | "satellite") => {
    onMapModeChange(mode);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`sm:hidden absolute z-20 pointer-events-auto ${className}`}
    >
      {/* Popover Menu (Directly above the trigger button) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-testid="mobile-map-style-popover"
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-full right-0 mb-2.5 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-float border border-white/90 flex flex-col gap-1 min-w-[155px] z-30"
          >
            {/* Standard / Sxema Option */}
            <button
              type="button"
              data-testid="mobile-map-style-standard"
              onClick={() => handleSelect("standard")}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                mapMode === "standard"
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 active:bg-slate-200/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <Map className={`h-4 w-4 ${mapMode === "standard" ? "text-white" : "text-[#16543C]"}`} />
                <span>{t.mapSection.standard}</span>
              </div>
              {mapMode === "standard" && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
            </button>

            {/* Satellite / Sun'iy yo'ldosh Option */}
            <button
              type="button"
              data-testid="mobile-map-style-satellite"
              onClick={() => handleSelect("satellite")}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                mapMode === "satellite"
                  ? "bg-[#16543C] text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 active:bg-slate-200/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className={`h-4 w-4 ${mapMode === "satellite" ? "text-white" : "text-[#16543C]"}`} />
                <span>{t.mapSection.satellite}</span>
              </div>
              {mapMode === "satellite" && <Check className="h-3.5 w-3.5 text-white shrink-0" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Floating Map Style Trigger Button */}
      <button
        type="button"
        data-testid="mobile-map-style-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={locale === "uz" ? "Xarita rejimini o‘zgartirish" : "Сменить режим карты"}
        aria-expanded={isOpen}
        className={`relative flex h-11 w-11 items-center justify-center rounded-2xl backdrop-blur-xl shadow-elevated border transition-all active:scale-95 ${
          isOpen || mapMode === "satellite"
            ? "bg-[#16543C] text-white border-[#16543C]/80 shadow-card"
            : "bg-white/95 text-[#16543C] border-white/90 hover:bg-white"
        }`}
      >
        <Layers className="h-5 w-5 transition-transform" />
        {/* Subtle active mode indicator dot when satellite is active and menu is closed */}
        {mapMode === "satellite" && !isOpen && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-[#16543C]" />
        )}
      </button>
    </div>
  );
}
