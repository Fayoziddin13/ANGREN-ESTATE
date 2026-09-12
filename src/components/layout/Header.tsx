"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Building2,
  KeyRound,
  Info,
  Phone,
  Globe,
  ChevronDown,
  Menu,
  X,
  User,
  LogOut,
  Heart,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/lib/favoriteStore";
import { useCMS } from "@/lib/cmsStore";
import { TransactionType } from "@/lib/types";

export interface HeaderProps {
  activeTransactionType?: TransactionType | "all";
  onTransactionTypeChange?: (type: TransactionType | "all") => void;
}

export function Header({ activeTransactionType, onTransactionTypeChange }: HeaderProps = {}) {
  const { locale, setLocale, t } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const { user, openAuthModal, handleLogout } = useAuth();
  const { favoritesCount } = useFavorites();
  const { announcement } = useCMS();

  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [currDropdownOpen, setCurrDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const currRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
      if (currRef.current && !currRef.current.contains(event.target as Node)) {
        setCurrDropdownOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Visual testing hook for mobile menu
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("menu") === "1") setMobileMenuOpen(true);
    }
  }, []);

  // Subtle scroll reaction
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 12) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const pathname = usePathname();

  const isHomeActive = onTransactionTypeChange
    ? activeTransactionType === "all"
    : pathname === "/";
  const isBuyActive = onTransactionTypeChange
    ? activeTransactionType === "sale"
    : pathname === "/sotib-olish";
  const isRentActive = onTransactionTypeChange
    ? activeTransactionType === "rent"
    : pathname === "/ijara";

  const navItems = [
    {
      href: "/",
      label: t.navigation.home,
      icon: Home,
      active: isHomeActive,
      onClick: (e: React.MouseEvent) => {
        if (onTransactionTypeChange) {
          e.preventDefault();
          onTransactionTypeChange("all");
          if (typeof window !== "undefined" && window.location.pathname !== "/") {
            window.history.pushState(null, "", "/");
          }
        }
      },
    },
    {
      href: "/sotib-olish",
      label: t.navigation.buy,
      icon: Building2,
      active: isBuyActive,
      onClick: (e: React.MouseEvent) => {
        if (onTransactionTypeChange) {
          e.preventDefault();
          onTransactionTypeChange("sale");
          if (typeof window !== "undefined" && window.location.pathname !== "/sotib-olish") {
            window.history.pushState(null, "", "/sotib-olish");
          }
        }
      },
    },
    {
      href: "/ijara",
      label: t.navigation.rent,
      icon: KeyRound,
      active: isRentActive,
      onClick: (e: React.MouseEvent) => {
        if (onTransactionTypeChange) {
          e.preventDefault();
          onTransactionTypeChange("rent");
          if (typeof window !== "undefined" && window.location.pathname !== "/ijara") {
            window.history.pushState(null, "", "/ijara");
          }
        }
      },
    },
    {
      href: "/biz-haqimizda",
      label: t.navigation.about,
      icon: Info,
      active: pathname === "/biz-haqimizda",
    },
    {
      href: "/kontaktlar",
      label: t.navigation.contacts,
      icon: Phone,
      active: pathname === "/kontaktlar",
    },
  ];

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-[#134431]/95 backdrop-blur-xl shadow-elevated border-b border-emerald-900/50"
          : "bg-[#16543C]/95 backdrop-blur-md shadow-md border-b border-white/10"
      }`}
    >
      {announcement?.is_active && (
        <div
          data-testid="cms-announcement-bar"
          className={`w-full py-2 px-3 sm:px-6 text-xs sm:text-sm font-medium text-center flex items-center justify-center gap-2 border-b transition-colors ${
            announcement.type === "warning"
              ? "bg-amber-500 text-slate-950 border-amber-600 font-semibold"
              : announcement.type === "success"
              ? "bg-emerald-600 text-white border-emerald-700 font-semibold"
              : "bg-emerald-950/90 text-emerald-100 border-emerald-800/60"
          }`}
        >
          <span>{locale === "ru" ? announcement.text_ru : announcement.text_uz}</span>
          {announcement.link_url && (
            <Link
              href={announcement.link_url}
              className="underline font-bold hover:opacity-80 transition-opacity ml-1 inline-flex items-center"
            >
              {locale === "ru" ? (announcement.link_text_ru || "Подробнее") : (announcement.link_text_uz || "Batafsil")} →
            </Link>
          )}
        </div>
      )}
      <div className="mx-auto flex h-16 sm:h-20 w-full max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Left: Official Brand Logo & Name */}
        <Link
          href="/"
          onClick={(e) => {
            if (onTransactionTypeChange) {
              e.preventDefault();
              onTransactionTypeChange("all");
              if (typeof window !== "undefined" && window.location.pathname !== "/") {
                window.history.pushState(null, "", "/");
              }
            }
          }}
          className="flex items-center gap-2.5 sm:gap-3 group shrink-0"
        >
          <div className="flex h-9 w-9 sm:h-11 sm:w-11 rounded-xl overflow-hidden shadow-sm transition-transform duration-200 group-hover:scale-105 shrink-0 bg-brand-dark/20 items-center justify-center">
            <Image
              src="/logo.png"
              alt="ANGREN ESTATE"
              width={44}
              height={44}
              className="h-full w-full object-contain rounded-xl"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tight text-sm sm:text-base leading-none text-white group-hover:text-emerald-200 transition-colors whitespace-nowrap">
              ANGREN ESTATE
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-emerald-200/70 tracking-wider uppercase mt-0.5">
              Ko‘chmas mulk
            </span>
          </div>
        </Link>

        {/* Center: Desktop Navigation Links with Lucide Icons */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={item.onClick}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 group ${
                  item.active
                    ? "text-white font-bold"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 ${
                    item.active
                      ? "text-white"
                      : "text-emerald-200/80 group-hover:text-white"
                  }`}
                />
                <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
                  {item.label}
                </span>

                {/* Elegant underline indicator for active item */}
                {item.active && (
                  <motion.div
                    layoutId="activeHeaderNav"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Desktop (Language, Currency, Google Login) */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Language Dropdown: [ 🌐 RU ⌵ ] */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-white/20 hover:border-white/30 transition-all active:scale-95"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-200" />
              <span>{locale.toUpperCase()}</span>
              <ChevronDown
                className={`h-3 w-3 text-emerald-200/80 transition-transform duration-200 ${
                  langDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {langDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-36 overflow-hidden rounded-2xl border border-white/15 bg-[#0E3324]/95 backdrop-blur-2xl p-1.5 shadow-float z-50"
                >
                  <button
                    onClick={() => {
                      setLocale("ru");
                      setLangDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      locale === "ru"
                        ? "bg-white/20 text-white font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>Русский</span>
                    {locale === "ru" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setLocale("uz");
                      setLangDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      locale === "uz"
                        ? "bg-white/20 text-white font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>O‘zbekcha</span>
                    {locale === "uz" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Currency Dropdown: [ UZS ⌵ ] */}
          <div className="relative" ref={currRef}>
            <button
              onClick={() => setCurrDropdownOpen(!currDropdownOpen)}
              className="flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-white/20 hover:border-white/30 transition-all active:scale-95"
            >
              <span>{currency}</span>
              <ChevronDown
                className={`h-3 w-3 text-emerald-200/80 transition-transform duration-200 ${
                  currDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {currDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-36 overflow-hidden rounded-2xl border border-white/15 bg-[#0E3324]/95 backdrop-blur-2xl p-1.5 shadow-float z-50"
                >
                  <button
                    onClick={() => {
                      setCurrency("UZS");
                      setCurrDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      currency === "UZS"
                        ? "bg-white/20 text-white font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>UZS (So‘m)</span>
                    {currency === "UZS" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setCurrency("USD");
                      setCurrDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      currency === "USD"
                        ? "bg-white/20 text-white font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>USD ($)</span>
                    {currency === "USD" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Google Sign In / User Profile Button */}
          {user ? (
            <div className="relative" ref={userRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-1.5 pr-3 text-xs font-semibold text-white hover:bg-white/20 transition-all shadow-sm active:scale-95"
              >
                <div className="h-7 w-7 rounded-xl bg-white text-brand-primary flex items-center justify-center font-black text-xs shadow-sm">
                  {user.full_name?.charAt(0) || <User className="h-3.5 w-3.5" />}
                </div>
                <span className="max-w-[110px] truncate">{user.full_name || user.email}</span>
                <ChevronDown className="h-3 w-3 text-emerald-200/80" />
              </button>

              <AnimatePresence>
                {userDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/15 bg-[#0E3324]/95 backdrop-blur-2xl p-2 shadow-float z-50 text-white"
                  >
                    <div className="px-3 py-2 border-b border-white/10 text-xs">
                      <p className="font-semibold text-white truncate">
                        {user.full_name || "Foydalanuvchi"}
                      </p>
                      <p className="text-emerald-200/70 truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/favorites"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-white/10 hover:text-white transition-colors mt-1"
                    >
                      <div className="flex items-center gap-2">
                        <Heart className="h-3.5 w-3.5 text-pink-400 fill-pink-400/20" />
                        <span>{locale === "uz" ? "Saqlanganlar" : "Избранное"}</span>
                      </div>
                      {favoritesCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-[10px] font-extrabold text-white">
                          {favoritesCount}
                        </span>
                      )}
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setUserDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-white/10 hover:text-red-400 transition-colors mt-0.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>{t.navigation.signOut}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-2 rounded-2xl bg-white text-brand-dark px-4 py-2 text-xs font-extrabold shadow-sm hover:bg-emerald-50 hover:shadow-card hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all"
            >
              {/* Google 4-Color SVG Icon */}
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </svg>
              <span>{t.navigation.signIn}</span>
            </button>
          )}
        </div>

        {/* Right Controls: Mobile (Language, Currency, Hamburger) */}
        <div className="flex sm:hidden items-center gap-1.5 shrink-0">
          {/* Mobile Language Button */}
          <button
            onClick={() => setLocale(locale === "ru" ? "uz" : "ru")}
            className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm active:scale-95 transition-all"
          >
            <Globe className="h-3 w-3 text-emerald-200" />
            <span>{locale.toUpperCase()}</span>
            <ChevronDown className="h-2.5 w-2.5 text-emerald-200/80" />
          </button>

          {/* Mobile Currency Button */}
          <button
            onClick={() => setCurrency(currency === "UZS" ? "USD" : "UZS")}
            className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm active:scale-95 transition-all"
          >
            <span>{currency}</span>
          </button>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-sm hover:bg-white/20 active:scale-95 transition-all"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Glass Dropdown Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="sm:hidden border-t border-white/10 bg-[#0E3324]/95 backdrop-blur-2xl px-4 pt-3 pb-6 space-y-3 shadow-float overflow-hidden"
          >
            <nav className="flex flex-col space-y-1 text-sm font-semibold">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      if (item.onClick) item.onClick(e);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-colors ${
                      item.active
                        ? "bg-white/15 text-white font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-emerald-300 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-2 border-t border-white/10">
              {user ? (
                <div className="p-3 rounded-2xl bg-white/10 border border-white/15 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-white truncate max-w-[200px]">
                      {user.full_name || user.email}
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-xs font-bold text-red-300 hover:text-red-200"
                    >
                      {t.navigation.signOut}
                    </button>
                  </div>
                  <Link
                    href="/favorites"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-emerald-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Heart className="h-3.5 w-3.5 text-pink-400 fill-pink-400/20" />
                      <span>{locale === "uz" ? "Saqlangan e'lonlar" : "Сохранённые объекты"}</span>
                    </div>
                    {favoritesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-pink-500 text-[10px] font-bold text-white">
                        {favoritesCount}
                      </span>
                    )}
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => {
                    openAuthModal();
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white py-2.5 text-xs font-extrabold text-brand-dark shadow-sm active:scale-[0.98] transition-all"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                    />
                  </svg>
                  <span>{t.navigation.signIn}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
