"use client";

import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function ScrollRailNav() {
  const { locale } = useLanguage();
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const checkScrollPosition = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      setIsAtTop(scrollY <= 30);
      setIsAtBottom(scrollY + windowHeight >= docHeight - 40);

      const totalScroll = docHeight - windowHeight;
      const progress = totalScroll > 0 ? Math.min(100, Math.max(0, (scrollY / totalScroll) * 100)) : 0;
      setScrollProgress(progress);
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
    <>
      {/* 3px Ultra-thin Vertical Scroll Progress Rail along right edge */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[3px] bg-slate-200/40 pointer-events-none z-50 hidden sm:block"
        aria-hidden="true"
      >
        <div
          className="w-full bg-gradient-to-b from-[#0c2e1f] via-[#19573c] to-[#339e71] transition-all duration-75 ease-out rounded-b-full shadow-xs"
          style={{ height: `${scrollProgress}%` }}
        />
      </div>

      {/* Floating Glass Navigation Controls */}
      <div
        id="scroll-rail-nav"
        aria-label={locale === "uz" ? "Sahifa bo‘yicha navigatsiya" : "Навигация по странице"}
        data-testid="scroll-rail-nav"
        className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-none select-none flex-col items-center"
      >
        <div className="pointer-events-auto flex flex-col items-center rounded-full bg-white/90 backdrop-blur-xl shadow-elevated border border-white/80 overflow-hidden transition-all duration-300 hover:shadow-float p-1 gap-1">
          {/* UP Button (↑) */}
          <button
            onClick={scrollToTop}
            disabled={isAtTop}
            data-testid="scroll-rail-up"
            aria-label={locale === "uz" ? "Yuqoriga" : "Наверх"}
            title={locale === "uz" ? "Yuqoriga" : "Наверх"}
            className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
              isAtTop
                ? "opacity-30 cursor-default text-gray-400 pointer-events-none"
                : "text-gray-700 hover:text-[#0c2e1f] hover:bg-[#e5f0eb]/50 active:scale-90"
            }`}
          >
            <ChevronUp className="h-4 w-4 stroke-[2.5]" />
          </button>

          {/* Mini progress tracker inside pill */}
          <div
            className="w-1 h-8 bg-slate-200/80 rounded-full overflow-hidden my-0.5"
            title={`${Math.round(scrollProgress)}%`}
          >
            <div
              className="w-full bg-[#0c2e1f] rounded-full transition-all duration-100 ease-out"
              style={{ height: `${scrollProgress}%` }}
            />
          </div>

          {/* DOWN Button (↓) */}
          <button
            onClick={scrollToNext}
            disabled={isAtBottom}
            data-testid="scroll-rail-down"
            aria-label={locale === "uz" ? "Pastga" : "Вниз"}
            title={locale === "uz" ? "Pastga" : "Вниз"}
            className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${
              isAtBottom
                ? "opacity-30 cursor-default text-gray-400 pointer-events-none"
                : "text-gray-700 hover:text-[#0c2e1f] hover:bg-[#e5f0eb]/50 active:scale-90"
            }`}
          >
            <ChevronDown className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </>
  );
}
