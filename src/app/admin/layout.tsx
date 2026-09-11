"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  Building2,
  PlusCircle,
  UserCheck,
  Users,
  Inbox,
  FileEdit,
  Compass,
  Settings,
  LogOut,
  Menu,
  X,
  Globe,
  ExternalLink,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Bypass layout completely on /admin/login
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navItems = [
    {
      href: "/admin",
      label: locale === "uz" ? "Dashboard" : "Обзор",
      icon: LayoutDashboard,
      active: pathname === "/admin",
    },
    {
      href: "/admin/analytics",
      label: locale === "uz" ? "Analitika" : "Аналитика",
      icon: LineChart,
      active: pathname.startsWith("/admin/analytics"),
    },
    {
      href: "/admin/properties",
      label: locale === "uz" ? "Obyektlar" : "Объекты",
      icon: Building2,
      active: pathname === "/admin/properties" || (pathname.startsWith("/admin/properties") && pathname !== "/admin/properties/new"),
    },
    {
      href: "/admin/properties/new",
      label: locale === "uz" ? "Obyekt qo‘shish" : "Добавить объект",
      icon: PlusCircle,
      active: pathname === "/admin/properties/new",
    },
    {
      href: "/admin/realtors",
      label: locale === "uz" ? "Rieltorlar" : "Риелторы",
      icon: UserCheck,
      active: pathname.startsWith("/admin/realtors"),
    },
    {
      href: "/admin/users",
      label: locale === "uz" ? "Foydalanuvchilar" : "Пользователи",
      icon: Users,
      active: pathname.startsWith("/admin/users"),
    },
    {
      href: "/admin/leads",
      label: locale === "uz" ? "Lidlar / Kontaktlar" : "Лиды / Заявки",
      icon: Inbox,
      active: pathname.startsWith("/admin/leads"),
    },
    {
      href: "/admin/content",
      label: locale === "uz" ? "Kontent (CMS)" : "Контент (CMS)",
      icon: FileEdit,
      active: pathname.startsWith("/admin/content"),
    },
    {
      href: "/admin/map",
      label: locale === "uz" ? "Xarita boshqaruvi" : "Управление картой",
      icon: Compass,
      active: pathname.startsWith("/admin/map"),
    },
    {
      href: "/admin/settings",
      label: locale === "uz" ? "Sozlamalar" : "Настройки",
      icon: Settings,
      active: pathname.startsWith("/admin/settings"),
    },
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error", e);
    }
    router.push("/admin/login");
    router.refresh();
  };

  // Find active item label for breadcrumb
  const activeNav = navItems.find((n) => n.active) || navItems[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased font-sans">
      {/* Mobile Top Navigation */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0E3324] text-white px-4 py-3 flex items-center justify-between shadow-md border-b border-emerald-900">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-lg overflow-hidden shrink-0 border border-white/20">
            <Image src="/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <div>
            <div className="text-xs font-black tracking-tight text-white leading-none">
              ANGREN ESTATE
            </div>
            <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-0.5">
              Admin Panel
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocale(locale === "uz" ? "ru" : "uz")}
            className="flex items-center gap-1 bg-white/10 text-white rounded-lg px-2.5 py-1 text-xs font-bold border border-white/20"
          >
            <Globe className="h-3 w-3 text-emerald-300" />
            <span>{locale.toUpperCase()}</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-white/10 text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A261A] text-white px-3 py-4 space-y-1 border-b border-emerald-950 shadow-2xl z-30">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold text-emerald-400/60">
            Menyu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  item.active
                    ? "bg-[#16543C] text-white font-bold"
                    : "text-emerald-100/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 text-emerald-300 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between px-3">
            <Link
              href="/"
              target="_blank"
              className="text-xs text-emerald-200 flex items-center gap-1 hover:text-white"
            >
              <span>{locale === "uz" ? "Saytni ko‘rish" : "Открыть сайт"}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-red-300 hover:text-red-200 font-bold flex items-center gap-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{locale === "uz" ? "Chiqish" : "Выйти"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0E3324] text-white shrink-0 border-r border-emerald-950 shadow-2xl min-h-screen sticky top-0 h-screen select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden shadow-md shrink-0 border border-white/15 group-hover:scale-105 transition-transform">
              <Image src="/logo.png" alt="Logo" fill className="object-cover" priority />
            </div>
            <div>
              <div className="font-black text-sm tracking-tight text-white leading-none">
                ANGREN ESTATE
              </div>
              <div className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-widest mt-1 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Control Center</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Items (10 sections) */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            {locale === "uz" ? "Boshqaruv bo‘limlari" : "Разделы управления"}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  item.active
                    ? "bg-[#16543C] text-white shadow-sm border border-emerald-600/50 translate-x-1"
                    : "text-emerald-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    item.active ? "text-emerald-300" : "text-emerald-300"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom Section: Language Switcher, Admin Profile, Logout */}
        <div className="p-3 border-t border-white/10 space-y-2 bg-[#0A261A]/80">
          {/* Language Switch */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-[11px] text-emerald-100 font-medium flex items-center gap-1.5">
              <Globe className="h-3 w-3" />
              Til / Язык
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLocale("uz")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  locale === "uz" ? "bg-white/20 text-white" : "text-emerald-200 hover:text-white"
                }`}
              >
                UZ
              </button>
              <span className="text-white/20">|</span>
              <button
                onClick={() => setLocale("ru")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  locale === "ru" ? "bg-white/20 text-white" : "text-emerald-200 hover:text-white"
                }`}
              >
                RU
              </button>
            </div>
          </div>

          {/* Admin User Profile & Logout */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                AD
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">Administrator</div>
                <div className="text-[10px] text-emerald-200 truncate">admin@angrenestate.uz</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title={locale === "uz" ? "Tizimdan chiqish" : "Выйти из системы"}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-red-400 hover:bg-white/10 transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Desktop Top Header Bar */}
        <div className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span>Admin</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="font-bold text-slate-900">{activeNav.label}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <span>{locale === "uz" ? "Saytni ochish" : "Открыть сайт"}</span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </Link>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
