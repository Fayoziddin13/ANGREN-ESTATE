"use client";

import React from "react";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="w-full bg-white border-t border-[#E8ECE9] py-8 pb-24 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-[#0d3431] p-0.5 shadow-xs shrink-0">
            <Image
              src="/logo.png"
              alt="ANGREN ESTATE Logo"
              width={28}
              height={28}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-extrabold tracking-tight text-xs sm:text-sm text-[#0d3431]">
            ANGREN ESTATE
          </span>
          <span className="text-[11px] text-gray-400">
            © {new Date().getFullYear()}
          </span>
        </div>

        {/* Location & Bilingual Badge */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-400">
          <span>Angren, Toshkent viloyati, O‘zbekiston</span>
          <span className="hidden sm:inline">•</span>
          <span className="font-semibold text-[#19453c]">
            UZ | RU
          </span>
        </div>

      </div>
    </footer>
  );
}
