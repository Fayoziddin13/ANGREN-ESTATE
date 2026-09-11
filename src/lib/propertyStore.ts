"use client";

import { useState, useEffect, useCallback } from "react";
import { Property, PropertyStatus } from "./types";

const PROPERTY_CHANGE_EVENT = "angren_estate_property_change";

export function useProperties(options?: { adminMode?: boolean }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const isAdminRoute =
        options?.adminMode ??
        (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"));

      const endpoint = isAdminRoute ? "/api/admin/properties" : "/api/properties";
      const res = await fetch(endpoint, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.properties)) {
          setProperties(data.properties);
          setIsLoaded(true);
          return;
        }
      }

      // If admin endpoint failed (e.g. not authenticated or unexpected), try public endpoint
      if (isAdminRoute) {
        const publicRes = await fetch("/api/properties", {
          headers: { "Cache-Control": "no-cache" },
        });
        if (publicRes.ok) {
          const publicData = await publicRes.json();
          if (publicData.success && Array.isArray(publicData.properties)) {
            setProperties(publicData.properties);
            setIsLoaded(true);
            return;
          }
        }
      }
    } catch (e) {
      console.error("[useProperties] Failed to fetch properties from canonical API:", e);
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, [options?.adminMode]);

  useEffect(() => {
    fetchProperties();

    const handlePropertyChange = () => {
      fetchProperties();
    };

    window.addEventListener(PROPERTY_CHANGE_EVENT, handlePropertyChange);
    return () => {
      window.removeEventListener(PROPERTY_CHANGE_EVENT, handlePropertyChange);
    };
  }, [fetchProperties]);

  const addProperty = async (data: Omit<Property, "id" | "created_at" | "updated_at">): Promise<Property | null> => {
    try {
      const res = await fetch("/api/admin/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (json.success && json.property) {
        // Broadcast change event
        window.dispatchEvent(new Event(PROPERTY_CHANGE_EVENT));
        // Optimistically update local state
        setProperties((prev) => [json.property, ...prev.filter((p) => p.id !== json.property.id)]);
        return json.property;
      }
      return null;
    } catch (e) {
      console.error("[useProperties] Error creating property:", e);
      return null;
    }
  };

  const updateProperty = async (id: string, updates: Partial<Property>): Promise<Property | null> => {
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const json = await res.json();
      if (json.success && json.property) {
        window.dispatchEvent(new Event(PROPERTY_CHANGE_EVENT));
        setProperties((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...json.property } : p))
        );
        return json.property;
      }
      return null;
    } catch (e) {
      console.error("[useProperties] Error updating property:", e);
      return null;
    }
  };

  const deleteProperty = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (json.success) {
        window.dispatchEvent(new Event(PROPERTY_CHANGE_EVENT));
        setProperties((prev) => prev.filter((p) => p.id !== id));
        return true;
      }
      return false;
    } catch (e) {
      console.error("[useProperties] Error deleting property:", e);
      return false;
    }
  };

  const duplicateProperty = async (id: string): Promise<Property | null> => {
    const original = properties.find((p) => p.id === id);
    if (!original) return null;

    const { id: _id, created_at: _c, updated_at: _u, ...rest } = original;

    const duplicatedData = {
      ...rest,
      slug: `${(original.slug || "obyekt").slice(0, 40)}-nusxa-${Date.now().toString().slice(-4)}`,
      title_uz: `${original.title_uz} (Nusxa)`,
      title_ru: `${original.title_ru} (Копия)`,
      status: "draft" as PropertyStatus,
      views_count: 0,
      favorites_count: 0,
      contacts_count: 0,
    };

    return await addProperty(duplicatedData);
  };

  const updatePropertyStatus = async (id: string, status: PropertyStatus): Promise<boolean> => {
    const result = await updateProperty(id, { status });
    return result !== null;
  };

  return {
    properties,
    publishedProperties: properties.filter((p) => p.status === "published"),
    draftProperties: properties.filter((p) => p.status === "draft"),
    soldProperties: properties.filter((p) => p.status === "sold"),
    rentedProperties: properties.filter((p) => p.status === "rented"),
    archivedProperties: properties.filter((p) => p.status === "archived"),
    isLoaded,
    isLoading,
    refresh: fetchProperties,
    addProperty,
    updateProperty,
    deleteProperty,
    duplicateProperty,
    updatePropertyStatus,
  };
}
