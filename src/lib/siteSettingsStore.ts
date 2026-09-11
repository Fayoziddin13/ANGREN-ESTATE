"use client";

import { useState, useEffect, useCallback } from "react";
import { SiteSettingsData, CMSSiteSettingsSection } from "./types";

export const defaultSiteSettings: SiteSettingsData = {
  site_name: "ANGREN ESTATE",
  logo_url: "/logo.png",
  favicon_url: "/logo.png",
  default_city: "Angren",
  default_currency: "UZS",
  default_language: "uz",
  map_center_lat: 41.0167,
  map_center_lng: 70.1436,
  map_default_zoom: 13,
  map_default_style: "standard",
  admin_phone: "+998 70 665 00 11",
  admin_telegram: "@angrenestate_admin",
  admin_email: "info@angrenestate.uz",
  instagram: "@angrenestate.uz",
  google_analytics_id: "G-ANGREN2026",
  internal_tracking: true,
  two_factor_ready: true,
};

// Pure backward-compatible stubs (zero localStorage in production)
export function getStoredSiteSettings(): SiteSettingsData {
  return defaultSiteSettings;
}

export function setStoredSiteSettings(_settings: SiteSettingsData): void {
  // Purge legacy storage key if present in browser
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("angren_estate_site_settings_v1");
    } catch {}
  }
}

/**
 * Modern Hook for Canonical Site Settings backed by Supabase app_settings
 */
export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettingsData>(defaultSiteSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // Purge obsolete legacy localStorage key if present
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("angren_estate_site_settings_v1");
        } catch {}
      }

      const res = await fetch("/api/content", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.content) {
          const s = data.content.settings || {};
          const c = data.content.contacts || {};
          setSettings((prev) => ({
            ...prev,
            site_name: s.site_name || prev.site_name,
            logo_url: s.logo_url || prev.logo_url,
            favicon_url: s.favicon_url || prev.favicon_url,
            default_city: s.default_city || prev.default_city,
            default_currency: s.default_currency || prev.default_currency,
            default_language: s.default_language || prev.default_language,
            map_center_lat: s.map_center_lat ?? prev.map_center_lat,
            map_center_lng: s.map_center_lng ?? prev.map_center_lng,
            map_default_zoom: s.map_default_zoom ?? prev.map_default_zoom,
            map_default_style: s.map_default_style || prev.map_default_style,
            admin_phone: c.phone || prev.admin_phone,
            admin_telegram: c.telegram || prev.admin_telegram,
            admin_email: c.email || prev.admin_email,
            instagram: c.instagram || prev.instagram,
          }));
        }
      }
    } catch (err) {
      console.warn("[useSiteSettings] Failed to fetch settings, using defaults:", err);
    } finally {
      setIsLoaded(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSettings = async (updates: Partial<SiteSettingsData>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  return {
    settings,
    isLoaded,
    isLoading,
    refresh,
    updateSettings,
  };
}
