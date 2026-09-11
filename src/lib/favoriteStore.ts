"use client";

import { useState, useEffect, useCallback } from "react";
import { Property } from "./types";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "./analytics";

// Legacy localStorage reference migrated to canonical Supabase public.favorites
const LEGACY_STORAGE_KEY = "angren_estate_favorites_v1";

export function useFavorites() {
  const { user, openAuthModal } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch real favorites from Supabase for authenticated user
  const refreshFavorites = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("property_id")
        .eq("user_id", userId);

      if (!error && data) {
        setFavoriteIds(data.map((f) => f.property_id));
      } else {
        setFavoriteIds([]);
      }
    } catch (err) {
      console.warn("[favoriteStore] Error fetching favorites:", err);
      setFavoriteIds([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFavoriteIds([]);
      setIsLoaded(true);
      return;
    }

    refreshFavorites(user.id);
  }, [user, refreshFavorites]);

  const isFavorite = useCallback(
    (propertyId: string) => {
      return favoriteIds.includes(propertyId);
    },
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    async (propertyOrId: Property | string) => {
      // 1. If visitor is unauthenticated, trigger AuthModal
      if (!user) {
        openAuthModal();
        return false;
      }

      const id = typeof propertyOrId === "string" ? propertyOrId : propertyOrId.id;
      const alreadySaved = favoriteIds.includes(id);

      // 2. Optimistic local update (< 50ms)
      const nextFavorites = alreadySaved
        ? favoriteIds.filter((x) => x !== id)
        : [...favoriteIds, id];

      setFavoriteIds(nextFavorites);

      // 3. Persist to Supabase public.favorites (governed by RLS)
      if (isSupabaseConfigured) {
        try {
          if (alreadySaved) {
            trackEvent("favorite_remove", { property_id: id, user_id: user.id });
            const { error } = await supabase
              .from("favorites")
              .delete()
              .eq("user_id", user.id)
              .eq("property_id", id);

            if (error) {
              console.error("[favoriteStore] Delete favorite error:", error.message);
              // Roll back optimistic state on error
              setFavoriteIds(favoriteIds);
              return true;
            }
          } else {
            trackEvent("favorite_add", { property_id: id, user_id: user.id });
            const { error } = await supabase.from("favorites").insert([
              {
                user_id: user.id,
                property_id: id,
              },
            ]);

            if (error) {
              console.error("[favoriteStore] Insert favorite error:", error.message);
              // Roll back optimistic state on error
              setFavoriteIds(favoriteIds);
              return false;
            }
          }
        } catch (err) {
          console.error("[favoriteStore] Exception syncing favorite:", err);
          // Roll back optimistic update
          setFavoriteIds(favoriteIds);
          return alreadySaved;
        }
      }

      return !alreadySaved;
    },
    [user, favoriteIds, openAuthModal]
  );

  return {
    favoriteIds,
    favoritesCount: favoriteIds.length,
    isFavorite,
    toggleFavorite,
    isLoaded,
    refreshFavorites: () => (user ? refreshFavorites(user.id) : Promise.resolve()),
  };
}

// Backward compatibility stub (non-canonical)
export function getStoredFavoriteIds(): string[] {
  return [];
}
