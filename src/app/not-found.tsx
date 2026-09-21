"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f9fbfa] flex flex-col justify-between text-[#0c2e1f] antialiased">
      {/* Brand Header */}
      <header className="w-full bg-[#0c2e1f] border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center group shrink-0" title="ANGREN ESTATE">
          <div className="relative h-10 w-[51px] flex items-center justify-center shrink-0">
            <Image
              src="/logo-white.png"
              alt="ANGREN ESTATE"
              width={56}
              height={44}
              className="h-full w-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              priority
            />
          </div>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Bosh sahifa / Главная</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-white border border-[#e2e9e6] shadow-card space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e5f0eb] text-[#19573c]">
            <span className="text-2xl font-black tracking-tight">404</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0c2e1f]">
              Sahifa topilmadi / Страница не найдена
            </h1>
            <p className="text-xs sm:text-sm text-[#43705c] leading-relaxed">
              Kechirasiz, siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko‘chirilgan.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-2xl bg-[#0c2e1f] hover:bg-[#19573c] text-white text-xs font-bold shadow-md shadow-[#0c2e1f]/20 transition-all active:scale-98"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Bosh sahifaga qaytish</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-[#43705c] border-t border-[#e2e9e6] bg-white">
        © {new Date().getFullYear()} ANGREN ESTATE. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
