"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, X, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCompare } from "@/lib/compareStore";

interface FloatingCompareBarProps {
  onOpenCompare: () => void;
  className?: string;
}

export function FloatingCompareBar({ onOpenCompare, className = "" }: FloatingCompareBarProps) {
  const { locale } = useLanguage();
  const { count, clearCompare } = useCompare();

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="floating-compare-bar"
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={`fixed bottom-20 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-40 pb-[env(safe-area-inset-bottom)] pointer-events-auto ${className}`}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white backdrop-blur-xl shadow-float border border-white/10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Scale className="h-4 w-4 text-[#2db477]" />
              <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">
                {count}
              </span>
            </div>
            <span className="text-xs font-black">
              {locale === "uz" ? "Solishtirish" : "Сравнение"} ({count}/3)
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenCompare}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#167d4f] hover:bg-[#145d3c] text-white text-xs font-black transition-all active:scale-95"
          >
            <span>{locale === "uz" ? "Ko‘rish" : "Открыть"}</span>
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={clearCompare}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={locale === "uz" ? "Tozalash" : "Очистить"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
