"use client";

import { useState, useEffect, useCallback } from "react";
import { Realtor, AdminContactInfo } from "./types";

export const defaultAdminContact: AdminContactInfo = {
  name: "Angren Estate Bosh Ofis",
  phone: "+998 90 123 45 67",
  telegram: "@angren_estate_admin",
  email: "admin@angrenestate.uz",
  working_hours_uz: "Dush - Shan: 09:00 - 18:00",
  working_hours_ru: "Пн - Сб: 09:00 - 18:00",
  instagram: "@angren_estate",
  address_uz: "Angren sh., Mustaqillik ko‘chasi, 14-uy",
  address_ru: "г. Ангрен, ул. Мустакиллик, д. 14",
  is_configured: true,
};

/**
 * Safely format Instagram handles or URLs into full HTTPS links.
 * Handles @username, username, or full URLs.
 */
export function formatInstagramUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/^http:\/\//, "https://");
  }
  const clean = trimmed.replace(/^@+/, "").replace(/^\/+/, "");
  return clean ? `https://instagram.com/${clean}` : null;
}

/**
 * Modern Supabase-backed React Hook for Realtors.
 * Completely eliminates browser client storage and mock seeds as production data sources.
 * Connects directly to server-side APIs backed by canonical database records:
 * - Jasur Alimov (00000000-0000-0000-0000-000000000001)
 * - Dilnoza Karimova (00000000-0000-0000-0000-000000000002)
 * - Rustam Zokirov (00000000-0000-0000-0000-000000000003)
 */
export function useRealtors(options?: { adminOnly?: boolean }) {
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRealtors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Determine if we should attempt admin endpoint or public endpoint
      // In admin context, /api/admin/realtors returns all realtors (including inactive) with counts
      const endpoint = options?.adminOnly || (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"))
        ? "/api/admin/realtors"
        : "/api/realtors";

      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) {
        // Fallback to public endpoint if admin returns 401
        if (res.status === 401 && endpoint !== "/api/realtors") {
          const pubRes = await fetch("/api/realtors", { cache: "no-store" });
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            setRealtors(pubData.realtors || []);
            setIsLoaded(true);
            setIsLoading(false);
            return;
          }
        }
        setError(`Failed to fetch realtors (${res.status})`);
        setIsLoading(false);
        setIsLoaded(true);
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.realtors)) {
        setRealtors(data.realtors);
      } else {
        setError(data.error || "Failed to load realtors");
      }
    } catch (err: any) {
      console.error("[useRealtors] Fetch error:", err);
      setError(err?.message || "Network error");
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, [options?.adminOnly]);

  useEffect(() => {
    fetchRealtors();
  }, [fetchRealtors]);

  // Create realtor via Admin API
  const addRealtor = async (realtorData: Omit<Realtor, "id" | "created_at">): Promise<Realtor | null> => {
    try {
      const res = await fetch("/api/admin/realtors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(realtorData),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to create realtor");
      }

      const data = await res.json();
      if (data.success && data.realtor) {
        setRealtors((prev) => [...prev, data.realtor]);
        return data.realtor;
      }
      return null;
    } catch (err) {
      console.error("[useRealtors] addRealtor error:", err);
      return null;
    }
  };

  // Edit realtor via Admin API
  const updateRealtor = async (id: string, updates: Partial<Realtor>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/realtors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.success && data.realtor) {
        setRealtors((prev) =>
          prev.map((r) => (r.id === id ? { ...r, ...data.realtor } : r))
        );
        return true;
      }
      return false;
    } catch (err) {
      console.error("[useRealtors] updateRealtor error:", err);
      return false;
    }
  };

  // Toggle active status via Admin API (strictly no deletion)
  const toggleRealtorStatus = async (id: string): Promise<boolean> => {
    const realtor = realtors.find((r) => r.id === id);
    if (!realtor) return false;
    const nextStatus = !realtor.is_active;
    return updateRealtor(id, { is_active: nextStatus });
  };

  // Assign or unassign property via Admin API
  const assignProperty = async (
    realtorId: string,
    propertyId: string,
    action: "assign" | "unassign" = "assign"
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/realtors/${realtorId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, action }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.success) {
        await fetchRealtors();
        return true;
      }
      return false;
    } catch (err) {
      console.error("[useRealtors] assignProperty error:", err);
      return false;
    }
  };

  return {
    realtors,
    activeRealtors: realtors.filter((r) => r.is_active),
    isLoaded,
    isLoading,
    error,
    refresh: fetchRealtors,
    addRealtor,
    updateRealtor,
    toggleRealtorStatus,
    assignProperty,
  };
}

/**
 * Modern Hook for Admin Contact Information
 */
export function useAdminContact() {
  const [contact, setContact] = useState<AdminContactInfo>(defaultAdminContact);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/content", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (mounted && data.success && data.content?.contacts) {
          const c = data.content.contacts;
          setContact({
            name: c.office_title_uz || defaultAdminContact.name,
            phone: c.phone || defaultAdminContact.phone,
            telegram: c.telegram || defaultAdminContact.telegram,
            email: c.email || defaultAdminContact.email,
            working_hours_uz: c.working_hours_uz || defaultAdminContact.working_hours_uz,
            working_hours_ru: c.working_hours_ru || defaultAdminContact.working_hours_ru,
            instagram: c.instagram || defaultAdminContact.instagram,
            address_uz: c.address_uz || defaultAdminContact.address_uz,
            address_ru: c.address_ru || defaultAdminContact.address_ru,
            is_configured: true,
          });
        }
      })
      .catch((err) => {
        console.warn("[useAdminContact] Using fallback:", err);
      })
      .finally(() => {
        if (mounted) setIsLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveContact = (newContact: Partial<AdminContactInfo>) => {
    setContact((prev) => ({
      ...prev,
      ...newContact,
      is_configured: Boolean(newContact.phone || newContact.telegram || newContact.email),
    }));
  };

  return {
    contact,
    isLoaded,
    saveContact,
  };
}
