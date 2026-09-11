"use client";

import React from "react";
import Image from "next/image";
import { useLanguage } from "@/context/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="w-full bg-white border-t border-gray-100 py-10 pb-24 sm:pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-brand-dark p-0.5 shadow-sm shrink-0">
            <Image
              src="/logo.png"
              alt="ANGREN ESTATE Logo"
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-extrabold tracking-tight text-sm text-brand-dark">
            ANGREN ESTATE
          </span>
          <span className="text-xs text-gray-400">
            © {new Date().getFullYear()}
          </span>
        </div>

        {/* Location & Bilingual Badge */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400">
          <span>Angren, Toshkent viloyati, O‘zbekiston</span>
          <span className="hidden sm:inline">•</span>
          <span className="font-semibold text-brand-primary">
            UZ | RU Bilingual Ready
          </span>
        </div>

      </div>
    </footer>
  );
}
