"use client";

import { useState, useEffect, useCallback } from "react";
import { Property } from "./types";

const COMPARE_STORAGE_KEY = "angren_estate_compare_v1";
const COMPARE_CHANGE_EVENT = "angren_estate_compare_change";
export const MAX_COMPARE_ITEMS = 3;

export function useCompare() {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadCompare = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCompareIds(parsed.slice(0, MAX_COMPARE_ITEMS));
        }
      }
    } catch {}
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadCompare();
    const handler = () => loadCompare();
    window.addEventListener(COMPARE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(COMPARE_CHANGE_EVENT, handler);
  }, [loadCompare]);

  const toggleCompare = (property: Property): { added: boolean; limitReached?: boolean } => {
    let updated: string[];
    const exists = compareIds.includes(property.id);

    if (exists) {
      updated = compareIds.filter((id) => id !== property.id);
      setCompareIds(updated);
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event(COMPARE_CHANGE_EVENT));
      return { added: false };
    } else {
      if (compareIds.length >= MAX_COMPARE_ITEMS) {
        return { added: false, limitReached: true };
      }
      updated = [...compareIds, property.id];
      setCompareIds(updated);
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event(COMPARE_CHANGE_EVENT));
      return { added: true };
    }
  };

  const removeCompare = (propertyId: string) => {
    const updated = compareIds.filter((id) => id !== propertyId);
    setCompareIds(updated);
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(COMPARE_CHANGE_EVENT));
  };

  const clearCompare = () => {
    setCompareIds([]);
    localStorage.removeItem(COMPARE_STORAGE_KEY);
    window.dispatchEvent(new Event(COMPARE_CHANGE_EVENT));
  };

  const isInCompare = (id: string) => compareIds.includes(id);

  return {
    compareIds,
    isLoaded,
    toggleCompare,
    removeCompare,
    clearCompare,
    isInCompare,
    count: compareIds.length,
    maxItems: MAX_COMPARE_ITEMS,
  };
}
