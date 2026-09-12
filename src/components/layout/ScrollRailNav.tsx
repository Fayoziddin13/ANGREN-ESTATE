"use client";

import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export function ScrollRailNav() {
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const checkScrollPosition = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      setIsAtTop(scrollY <= 30);
      setIsAtBottom(scrollY + windowHeight >= docHeight - 40);
    };

    checkScrollPosition();
    window.addEventListener("scroll", checkScrollPosition, { passive: true });
    window.addEventListener("resize", checkScrollPosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, []);

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
      id="scroll-rail-nav"
      aria-label="Sahifa bo'yicha navigatsiya"
      data-testid="scroll-rail-nav"
      className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none select-none flex-col items-center"
    >
      <div className="pointer-events-auto flex flex-col rounded-full bg-white/85 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden transition-all duration-300 hover:shadow-float p-0.5 gap-0.5">
        {/* UP Button (↑) */}
        <button
          onClick={scrollToTop}
          disabled={isAtTop}
          data-testid="scroll-rail-up"
          aria-label="Yuqoriga"
          title="Yuqoriga"
          className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
            isAtTop
              ? "opacity-30 cursor-default text-gray-400 pointer-events-none"
              : "text-gray-700 hover:text-[#16543C] hover:bg-emerald-50/70 active:scale-90"
          }`}
        >
          <ChevronUp className="h-4 w-4 stroke-[2.5]" />
        </button>

        <div className="w-4 h-[1px] bg-gray-200/60 mx-auto" />

        {/* DOWN Button (↓) */}
        <button
          onClick={scrollToNext}
          disabled={isAtBottom}
          data-testid="scroll-rail-down"
          aria-label="Pastga"
          title="Pastga"
          className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
            isAtBottom
              ? "opacity-30 cursor-default text-gray-400 pointer-events-none"
              : "text-gray-700 hover:text-[#16543C] hover:bg-emerald-50/70 active:scale-90"
          }`}
        >
          <ChevronDown className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
