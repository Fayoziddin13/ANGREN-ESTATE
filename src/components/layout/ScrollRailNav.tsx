"use client";

import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export function ScrollRailNav() {
  const scrollToTop = () => {
    const mapEl = document.getElementById("map-section");
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToNext = () => {
    const nextEl = document.getElementById("popular-section");
    if (nextEl) {
      nextEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  return (
    <div
      aria-label="Sahifa bo'yicha navigatsiya"
      className="hidden lg:flex fixed left-3 xl:left-5 top-1/2 -translate-y-1/2 z-30 pointer-events-none select-none"
    >
      <div className="pointer-events-auto flex flex-col rounded-2xl bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden transition-all duration-200 hover:shadow-card">
        {/* UP Button (↑) */}
        <button
          onClick={scrollToTop}
          aria-label="Yuqoriga (Xarita)"
          title="Xarita"
          className="flex h-9 w-9 items-center justify-center text-gray-700 hover:text-[#16543C] hover:bg-emerald-50/60 transition-colors border-b border-gray-100/90 active:scale-95 focus:outline-none"
        >
          <ArrowUp className="h-4 w-4 stroke-[2.2]" />
        </button>

        {/* DOWN Button (↓) */}
        <button
          onClick={scrollToNext}
          aria-label="Pastga (Takliflar)"
          title="Pastga"
          className="flex h-9 w-9 items-center justify-center text-gray-700 hover:text-[#16543C] hover:bg-emerald-50/60 transition-colors active:scale-95 focus:outline-none"
        >
          <ArrowDown className="h-4 w-4 stroke-[2.2]" />
        </button>
      </div>
    </div>
  );
}
