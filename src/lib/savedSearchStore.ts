"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SavedSearch, SavedSearchFilter, InAppNotification, Property } from "./types";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "angren_estate_saved_searches_v1";
const NOTIFICATIONS_KEY = "angren_estate_notifications_v1";
const CHANGE_EVENT = "angren_estate_saved_search_change";

export function useSavedSearches() {
  const { user, openAuthModal } = useAuth();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from local storage and hydrate from API if user is authenticated
  const loadSearches = useCallback(async () => {
    try {
      if (typeof window === "undefined") return;

      let localSearches: SavedSearch[] = [];
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          localSearches = JSON.parse(raw);
        } catch {}
      }

      if (user?.id) {
        try {
          const res = await fetch(`/api/user/saved-searches?userId=${user.id}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.savedSearches)) {
              // Merge local searches with server searches
              const combinedMap = new Map<string, SavedSearch>();
              data.savedSearches.forEach((s: SavedSearch) => combinedMap.set(s.id, s));
              localSearches.forEach((s: SavedSearch) => {
                if (!combinedMap.has(s.id)) {
                  combinedMap.set(s.id, { ...s, userId: user.id });
                }
              });
              const merged = Array.from(combinedMap.values());
              setSavedSearches(merged);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              return;
            }
          }
        } catch (apiErr) {
          console.warn("[SavedSearchStore] Server fetch warning:", apiErr);
        }
      }

      setSavedSearches(localSearches);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load in-app notifications
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawNotifs = localStorage.getItem(NOTIFICATIONS_KEY);
      if (rawNotifs) {
        setNotifications(JSON.parse(rawNotifs));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSearches();

    const handleEvent = () => loadSearches();
    window.addEventListener(CHANGE_EVENT, handleEvent);
    return () => window.removeEventListener(CHANGE_EVENT, handleEvent);
  }, [loadSearches]);

  // Save new search
  const saveSearch = async (
    filters: SavedSearchFilter,
    customTitle?: string
  ): Promise<{ success: boolean; requiresAuth?: boolean }> => {
    // If anonymous, prompt login
    if (!user) {
      openAuthModal();
      return { success: false, requiresAuth: true };
    }

    const titleParts: string[] = [];
    if (filters.district && filters.district !== "all") titleParts.push(filters.district);
    if (filters.propertyType && filters.propertyType !== "all") titleParts.push(filters.propertyType);
    if (filters.rooms) titleParts.push(`${filters.rooms}-xonali`);
    if (filters.query) titleParts.push(`"${filters.query}"`);

    const autoTitle =
      titleParts.length > 0 ? titleParts.join(" • ") : "Barcha e’lonlar filtri";

    const newSearch: SavedSearch = {
      id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: user.id,
      title: customTitle || autoTitle,
      filters,
      createdAt: new Date().toISOString(),
    };

    const updated = [newSearch, ...savedSearches.filter((s) => s.id !== newSearch.id)];
    setSavedSearches(updated);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }

    // Persist to server
    try {
      await fetch("/api/user/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, search: newSearch }),
      });
    } catch (e) {
      console.warn("[SavedSearchStore] Server save warning:", e);
    }

    return { success: true };
  };

  // Remove search
  const removeSearch = async (id: string) => {
    const updated = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(updated);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }

    if (user?.id) {
      try {
        await fetch(`/api/user/saved-searches?userId=${user.id}&id=${id}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.warn("[SavedSearchStore] Server delete warning:", e);
      }
    }
  };

  // Check matching properties and generate in-app notification alerts
  const checkMatchingAlerts = useCallback(
    (properties: Property[]) => {
      if (!savedSearches.length || !properties.length || typeof window === "undefined") return;

      const newNotifs: InAppNotification[] = [];
      const now = new Date();

      savedSearches.forEach((search) => {
        const matches = properties.filter((p) => {
          const f = search.filters;
          if (f.transactionType && f.transactionType !== "all" && p.transaction_type !== f.transactionType)
            return false;
          if (f.propertyType && f.propertyType !== "all" && p.property_type !== f.propertyType)
            return false;
          if (f.rooms && p.rooms !== f.rooms) return false;
          if (f.district && f.district !== "all") {
            const q = f.district.toLowerCase();
            const m =
              p.district?.toLowerCase().includes(q) ||
              p.district_name_uz?.toLowerCase().includes(q);
            if (!m) return false;
          }
          if (f.priceMin && (p.price_uzs || p.price || 0) < f.priceMin) return false;
          if (f.priceMax && (p.price_uzs || p.price || 0) > f.priceMax) return false;
          return true;
        });

        if (matches.length > 0) {
          const first = matches[0];
          const notifId = `notif-${search.id}-${first.id}`;
          // Check if already notified
          if (!notifications.some((n) => n.id === notifId)) {
            newNotifs.push({
              id: notifId,
              titleUz: "Mos yangi e’lon topildi",
              titleRu: "Найден подходящий объект",
              messageUz: `"${search.title}" qidiruvingizga mos e’lon: ${first.title_uz}`,
              messageRu: `По поиску "${search.title}": ${first.title_ru}`,
              propertyId: first.id,
              propertySlug: first.slug,
              createdAt: now.toISOString(),
              read: false,
            });
          }
        }
      });

      if (newNotifs.length > 0) {
        const updated = [...newNotifs, ...notifications].slice(0, 30);
        setNotifications(updated);
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      }
    },
    [savedSearches, notifications]
  );

  const markNotificationRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(NOTIFICATIONS_KEY);
    }
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return {
    savedSearches,
    isLoading,
    saveSearch,
    removeSearch,
    notifications,
    unreadNotificationsCount: unreadCount,
    markNotificationRead,
    clearAllNotifications,
    checkMatchingAlerts,
  };
}
