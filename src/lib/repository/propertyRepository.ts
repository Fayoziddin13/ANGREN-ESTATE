import { Property, PropertyStatus, TransactionType, PropertyType } from "../types";
import { supabase, isSupabaseConfigured } from "../supabase";

export interface PropertyFilterParams {
  transaction_type?: TransactionType | "all";
  deal_type?: TransactionType | "all";
  district?: string;
  property_type?: PropertyType | "all";
  price_min?: number;
  price_max?: number;
  rooms?: number;
  search_query?: string;
}

export interface IPropertyRepository {
  getPublishedProperties(filters?: PropertyFilterParams): Promise<Property[]>;
  getPropertyById(id: string): Promise<Property | null>;
  getPropertyBySlug(slug: string): Promise<Property | null>;
  getAllPropertiesAdmin(status?: PropertyStatus | "all"): Promise<Property[]>;
  createProperty(data: Omit<Property, "id" | "created_at" | "slug">): Promise<Property>;
  updateProperty(id: string, data: Partial<Property>): Promise<Property | null>;
  updatePropertyStatus(id: string, status: PropertyStatus): Promise<boolean>;
  deleteProperty(id: string): Promise<boolean>;
  getDistricts(): Promise<{ id: string; name_uz: string; name_ru: string; lat: number; lng: number }[]>;
}

// -----------------------------------------------------------------------------
// Unified Canonical Property Repository
// -----------------------------------------------------------------------------
export class CanonicalPropertyRepository implements IPropertyRepository {
  async getPublishedProperties(filters?: PropertyFilterParams): Promise<Property[]> {
    if (typeof window === "undefined") {
      // Server-side: import directly from properties service
      const { getPublishedProperties } = await import("../properties");
      return await getPublishedProperties(filters);
    }

    try {
      const params = new URLSearchParams();
      if (filters?.transaction_type && filters.transaction_type !== "all") {
        params.set("type", filters.transaction_type);
      }
      if (filters?.district && filters.district !== "all") {
        params.set("district", filters.district);
      }
      if (filters?.property_type && filters.property_type !== "all") {
        params.set("property_type", filters.property_type);
      }
      if (filters?.price_min) {
        params.set("price_min", String(filters.price_min));
      }
      if (filters?.price_max) {
        params.set("price_max", String(filters.price_max));
      }
      if (filters?.rooms) {
        params.set("rooms", String(filters.rooms));
      }
      if (filters?.search_query) {
        params.set("q", filters.search_query);
      }

      const res = await fetch(`/api/properties?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.properties) ? json.properties : [];
    } catch (e) {
      console.error("[CanonicalPropertyRepository] getPublishedProperties failed:", e);
      return [];
    }
  }

  async getPropertyById(id: string): Promise<Property | null> {
    if (typeof window === "undefined") {
      const { getPropertyById } = await import("../properties");
      return await getPropertyById(id);
    }

    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(id)}`);
      if (!res.ok) {
        // If public 404, maybe admin is logged in and viewing draft/archived
        const adminRes = await fetch(`/api/admin/properties/${encodeURIComponent(id)}`);
        if (adminRes.ok) {
          const adminJson = await adminRes.json();
          return adminJson.success ? adminJson.property : null;
        }
        return null;
      }
      const json = await res.json();
      return json.success ? json.property : null;
    } catch (e) {
      console.error(`[CanonicalPropertyRepository] getPropertyById failed for ${id}:`, e);
      return null;
    }
  }

  async getPropertyBySlug(slug: string): Promise<Property | null> {
    if (typeof window === "undefined") {
      const { getPropertyBySlug } = await import("../properties");
      return await getPropertyBySlug(slug);
    }

    const all = await this.getPublishedProperties();
    return all.find((p) => p.slug === slug || p.id === slug) || null;
  }

  async getAllPropertiesAdmin(status?: PropertyStatus | "all"): Promise<Property[]> {
    if (typeof window === "undefined") {
      const { getAdminProperties } = await import("../properties");
      return await getAdminProperties(status);
    }

    try {
      const url = status && status !== "all" ? `/api/admin/properties?status=${status}` : "/api/admin/properties";
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.properties) ? json.properties : [];
    } catch (e) {
      console.error("[CanonicalPropertyRepository] getAllPropertiesAdmin failed:", e);
      return [];
    }
  }

  async createProperty(data: Omit<Property, "id" | "created_at" | "slug">): Promise<Property> {
    if (typeof window === "undefined") {
      const { createProperty } = await import("../properties");
      return await createProperty(data);
    }

    const res = await fetch("/api/admin/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success || !json.property) {
      throw new Error(json.error || "Failed to create property in canonical database");
    }
    return json.property;
  }

  async updateProperty(id: string, data: Partial<Property>): Promise<Property | null> {
    if (typeof window === "undefined") {
      const { updateProperty } = await import("../properties");
      return await updateProperty(id, data);
    }

    const res = await fetch(`/api/admin/properties/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json.success ? json.property : null;
  }

  async updatePropertyStatus(id: string, status: PropertyStatus): Promise<boolean> {
    const updated = await this.updateProperty(id, { status });
    return updated !== null;
  }

  async deleteProperty(id: string): Promise<boolean> {
    if (typeof window === "undefined") {
      const { deleteProperty } = await import("../properties");
      return await deleteProperty(id);
    }

    const res = await fetch(`/api/admin/properties/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    return Boolean(json.success);
  }

  async getDistricts() {
    return [
      { id: "markaz", name_uz: "Markaz", name_ru: "Центр", lat: 41.0167, lng: 70.1436 },
      { id: "5-mavze", name_uz: "5-mavze", name_ru: "5-массив", lat: 41.0125, lng: 70.138 },
      { id: "6-mavze", name_uz: "6-mavze", name_ru: "6-массив", lat: 41.019, lng: 70.132 },
      { id: "7-mavze", name_uz: "7-mavze", name_ru: "7-массив", lat: 41.024, lng: 70.126 },
      { id: "dukent", name_uz: "Dukent", name_ru: "Дукент", lat: 41.038, lng: 70.175 },
      { id: "geolog", name_uz: "Geolog", name_ru: "Геолог", lat: 41.008, lng: 70.155 },
      { id: "yangiobod", name_uz: "Yangiobod mavzesi", name_ru: "Массив Янгиабад", lat: 41.042, lng: 70.108 },
    ];
  }
}

// -----------------------------------------------------------------------------
// Singleton Provider Factory
// -----------------------------------------------------------------------------
let repositoryInstance: IPropertyRepository | null = null;

export function getPropertyRepository(): IPropertyRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CanonicalPropertyRepository();
  }
  return repositoryInstance;
}
