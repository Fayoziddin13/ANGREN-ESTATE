"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Locale } from "@/lib/types";
import { dictionaries, Dictionary } from "@/locales";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("uz");

  useEffect(() => {
    // Check URL search params first (e.g. ?lang=ru)
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const paramLang = urlParams.get("lang") as Locale;
      if (paramLang === "uz" || paramLang === "ru") {
        setLocaleState(paramLang);
        localStorage.setItem("angren_estate_lang", paramLang);
        document.documentElement.lang = paramLang;
        return;
      }
    }

    const saved = localStorage.getItem("angren_estate_lang") as Locale;
    if (saved === "uz" || saved === "ru") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  // Sync document title and meta description on locale switch
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSEO = async () => {
      try {
        const res = await fetch("/api/content", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.content?.seo) {
            const seo = data.content.seo;
            const title = locale === "ru" ? seo.site_title_ru : seo.site_title_uz;
            const desc = locale === "ru" ? seo.meta_description_ru : seo.meta_description_uz;
            if (document.title.includes("ANGREN ESTATE") || !document.title) {
              document.title = title;
            }
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
              metaDesc = document.createElement("meta");
              metaDesc.setAttribute("name", "description");
              document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute("content", desc);
            return;
          }
        }
      } catch {}

      // Fallback
      if (locale === "ru") {
        if (document.title.includes("ANGREN ESTATE") || !document.title) {
          document.title = "ANGREN ESTATE — Недвижимость Ангрена на единой карте";
        }
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute("content", "Лучшие квартиры, дома и коммерческая недвижимость в Ангрене. Продажа и аренда.");
        }
      } else {
        if (document.title.includes("ANGREN ESTATE") || !document.title) {
          document.title = "ANGREN ESTATE — Angren ko‘chmas mulki yagona xaritada";
        }
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute("content", "Angren shahrining eng yaxshi kvartira, hovli va tijorat binolari. Sotuv va ijara.");
        }
      }
    };

    syncSEO();
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("angren_estate_lang", newLocale);
    document.documentElement.lang = newLocale;
  };

  const t = dictionaries[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
