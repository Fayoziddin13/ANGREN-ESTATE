"use client";

import React from "react";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="w-full bg-white border-t border-[#e2e9e6] py-8 pb-24 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Copyright */}
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-[40px] flex items-center justify-center shrink-0">
            <Image
              src="/logo-dark.png"
              alt="ANGREN ESTATE"
              width={40}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="text-[11px] text-gray-400 font-medium">
            © {new Date().getFullYear()}
          </span>
        </div>

        {/* Location & Bilingual Badge */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-400">
          <span>Angren, Toshkent viloyati, O‘zbekiston</span>
          <span className="hidden sm:inline">•</span>
          <span className="font-semibold text-[#19573c]">
            UZ | RU
          </span>
        </div>

      </div>
    </footer>
  );
}
