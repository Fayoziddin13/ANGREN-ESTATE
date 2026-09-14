import fs from "fs";
import path from "path";
import { Property, PropertyStatus, TransactionType, PropertyType } from "./types";
import { supabase, isSupabaseConfigured } from "./supabase";
import { supabaseAdmin } from "./supabaseServer";

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

const DATA_FILE_PATH = path.join(process.cwd(), "data", "properties.json");

// Helper: Map database row to standard Property model
export function mapRowToProperty(row: any): Property {
  const lat = Number(row.latitude ?? (row.coordinates?.lat || 41.0167));
  const lng = Number(row.longitude ?? (row.coordinates?.lng || 70.1436));
  const coords = { lat, lng };

  const utils = row.utilities || {
    electricity: Boolean(row.electricity ?? row.utilities?.electricity ?? true),
    gas: Boolean(row.gas ?? row.utilities?.gas ?? true),
    cold_water: Boolean(row.cold_water ?? row.water ?? row.utilities?.cold_water ?? row.utilities?.water ?? true),
    hot_water: Boolean(row.hot_water ?? row.utilities?.hot_water ?? true),
    heating: Boolean(row.heating ?? row.utilities?.heating ?? true),
    internet: Boolean(row.internet ?? row.utilities?.internet ?? row.amenities?.internet ?? true),
    water: Boolean(row.water ?? row.utilities?.water ?? true),
    sewerage: Boolean(row.sewerage ?? row.utilities?.sewerage ?? true),
    custom: Array.isArray(row.utilities?.custom) ? row.utilities.custom : [],
  };

  const amens = row.amenities || {
    furniture: Boolean(row.furniture ?? false),
    parking: Boolean(row.parking ?? false),
    elevator: Boolean(row.elevator ?? false),
    ac: Boolean(row.air_conditioning ?? false),
    balcony: Boolean(row.balcony ?? false),
    internet: Boolean(row.internet ?? true),
  };

  const photos =
    Array.isArray(row.photos) && row.photos.length > 0
      ? row.photos
      : Array.isArray(row.images) && row.images.length > 0
      ? row.images
      : [];

    const realtorRaw = row.realtors || row.realtor;
    const realtorObj = Array.isArray(realtorRaw) ? realtorRaw[0] : realtorRaw;
    const realtor = realtorObj
      ? {
          id: String(realtorObj.id),
          name: realtorObj.name || "",
          avatar_url: realtorObj.avatar_url || realtorObj.photo_url || undefined,
          photo_url: realtorObj.photo_url || realtorObj.avatar_url || undefined,
          phone: realtorObj.phone || "",
          telegram: realtorObj.telegram || "",
          instagram_url: realtorObj.instagram_url || realtorObj.instagram || undefined,
          instagram: realtorObj.instagram_url || realtorObj.instagram || undefined,
          experience_years: Number(realtorObj.experience_years || 1),
          position_uz: realtorObj.position_uz || undefined,
          position_ru: realtorObj.position_ru || undefined,
          specialization_uz: realtorObj.specialization_uz || "",
          specialization_ru: realtorObj.specialization_ru || "",
          districts: Array.isArray(realtorObj.districts) ? realtorObj.districts : [],
          bio_uz: realtorObj.bio_uz || undefined,
          bio_ru: realtorObj.bio_ru || undefined,
          is_active: Boolean(realtorObj.is_active ?? true),
          created_at: realtorObj.created_at || new Date().toISOString(),
        }
      : undefined;

    return {
      id: String(row.id),
      slug: row.slug || `property-${row.id}`,
      title_uz: row.title_uz || "",
      title_ru: row.title_ru || "",
      description_uz: row.description_uz || "",
      description_ru: row.description_ru || "",
      address_uz: row.address_uz || row.address || "",
      address_ru: row.address_ru || row.address || "",
      district_name_uz: row.district_name_uz || row.district || "Markaz",
      district_name_ru: row.district_name_ru || row.district || "Центр",
      district: row.district || row.district_name_uz || "Markaz",
      neighborhood: row.neighborhood || row.district || "Markaz",
      transaction_type: (row.transaction_type || row.deal_type || "sale") as TransactionType,
      deal_type: (row.deal_type || row.transaction_type || "sale") as TransactionType,
      property_type: (row.property_type || "apartment") as PropertyType,
      status: (row.status || "published") as PropertyStatus,
      price: Number(row.price || row.price_uzs || 0),
      price_uzs: Number(row.price_uzs || row.price || 0),
      price_usd: Number(row.price_usd || Math.round((row.price_uzs || row.price || 0) / 12850)),
      currency: (row.currency || "UZS") as any,
      price_negotiable: Boolean(row.price_negotiable),
      area_sqm: Number(row.area_sqm || row.area || 0),
      area: Number(row.area || row.area_sqm || 0),
      area_sotikh: row.area_sotikh ? Number(row.area_sotikh) : row.id === "prop-3" ? 6 : undefined,
      living_area_sqm: row.living_area_sqm ? Number(row.living_area_sqm) : undefined,
      living_area: row.living_area ? Number(row.living_area) : undefined,
      rooms: Number(row.rooms || 1),
      bathrooms: Number(row.bathrooms || 1),
      floor: Number(row.floor || row.floor_number || 1),
      floor_number: Number(row.floor_number || row.floor || 1),
      total_floors: Number(row.total_floors ?? (row.floors || 1)),
      floors: Number(row.floors ?? (row.total_floors || 1)),
      renovation: (row.renovation || "euro") as any,
      furniture: Boolean(row.furniture),
      parking: Boolean(row.parking),
      images: photos,
      photos: photos,
      main_image: row.main_image || photos[0] || undefined,
      video_url: row.video_url || undefined,
      coordinates: coords,
      latitude: lat,
      longitude: lng,
      polygon: row.polygon || row.polygon_coordinates || undefined,
      polygon_coordinates: row.polygon_coordinates || row.polygon || undefined,
      utilities: utils,
      amenities: amens,
      contact_phone: row.contact_phone || "+998 90 123 45 67",
      contact_telegram: row.contact_telegram || row.telegram || undefined,
      telegram: row.telegram || row.contact_telegram || undefined,
      owner_phone: row.owner_phone || amens?.owner_phone || undefined,
      realtor_id: row.realtor_id || undefined,
      realtor: realtor,
      facade_m: row.facade_m ? Number(row.facade_m) : amens?.facade_m ? Number(amens.facade_m) : row.id === "prop-3" ? 15 : undefined,
      depth_m: row.depth_m ? Number(row.depth_m) : amens?.depth_m ? Number(amens.depth_m) : row.id === "prop-3" ? 40 : undefined,
      dimensions:
        row.dimensions ||
        amens?.dimensions ||
        ((row.facade_m || amens?.facade_m) && (row.depth_m || amens?.depth_m) ? `${row.facade_m || amens?.facade_m} × ${row.depth_m || amens?.depth_m} m` : undefined) ||
        (row.id === "prop-3" ? "15 × 40 m" : undefined),
      views_count: Number(row.views_count || 0),
      favorites_count: Number(row.favorites_count || 0),
      contacts_count: Number(row.contacts_count || 0),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      published_at: row.published_at || undefined,
      hudud_id: row.hudud_id || amens?.hudud_id || row.district || undefined,
      is_top: Boolean(row.is_top ?? amens?.is_top ?? (row.id === "prop-1" || row.id === "prop-4")),
      is_fast_sale: Boolean(row.is_fast_sale ?? amens?.is_fast_sale ?? (row.id === "prop-2")),
      is_good_deal: Boolean(row.is_good_deal ?? amens?.is_good_deal ?? (row.id === "prop-5")),
      badges: (() => {
        const isTop = Boolean(row.is_top ?? amens?.is_top ?? (row.id === "prop-1" || row.id === "prop-4"));
        const isFast = Boolean(row.is_fast_sale ?? amens?.is_fast_sale ?? (row.id === "prop-2"));
        const isGood = Boolean(row.is_good_deal ?? amens?.is_good_deal ?? (row.id === "prop-5"));
        const pubTime = row.published_at ? new Date(row.published_at).getTime() : new Date(row.created_at || 0).getTime();
        const isNew = (row.status === "published") && (Date.now() - pubTime < 3 * 24 * 60 * 60 * 1000);
        
        const b: any[] = [];
        if (isTop) b.push("top");
        if (isNew) b.push("new");
        if (isFast) b.push("tez_sotiladi");
        if (isGood) b.push("yaxshi_taklif");
        return b;
      })(),
    };
}

// Helper: Map Property model to database columns for insertion/update
export function mapPropertyToDb(data: any): Record<string, any> {
  const lat = data.latitude || data.coordinates?.lat || 41.0167;
  const lng = data.longitude || data.coordinates?.lng || 70.1436;
  const rawPhotos: string[] = Array.isArray(data.photos)
    ? data.photos
    : Array.isArray(data.images)
    ? data.images
    : [];
  const mainImage = data.main_image || rawPhotos[0] || null;
  // Place main image at index 0 if specified, while preserving remaining order
  const photos =
    mainImage && rawPhotos.includes(mainImage)
      ? [mainImage, ...rawPhotos.filter((p: string) => p !== mainImage)]
      : rawPhotos;

  // Validate UUID for realtor_id (Supabase requires valid UUID or null)
  const isValidUuid = (val: any) =>
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

  // Preserve owner_phone, facade_m, depth_m, dimensions, badges, is_top, etc. inside amenities JSONB
  const baseAmenities =
    typeof data.amenities === "object" && data.amenities !== null ? { ...data.amenities } : {};
  if (data.owner_phone) baseAmenities.owner_phone = data.owner_phone;
  if (data.facade_m) baseAmenities.facade_m = Number(data.facade_m);
  if (data.depth_m) baseAmenities.depth_m = Number(data.depth_m);
  if (data.dimensions) {
    baseAmenities.dimensions = data.dimensions;
  } else if (data.facade_m && data.depth_m) {
    baseAmenities.dimensions = `${data.facade_m} × ${data.depth_m} m`;
  }
  if (data.is_top !== undefined) baseAmenities.is_top = Boolean(data.is_top);
  if (data.is_fast_sale !== undefined) baseAmenities.is_fast_sale = Boolean(data.is_fast_sale);
  if (data.is_good_deal !== undefined) baseAmenities.is_good_deal = Boolean(data.is_good_deal);
  if (data.hudud_id) baseAmenities.hudud_id = data.hudud_id;
  if (Array.isArray(data.badges)) baseAmenities.badges = data.badges;

  return {
    id: data.id,
    slug:
      data.slug ||
      `${(data.title_uz || "obyekt")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 45)}-${Date.now().toString().slice(-6)}`,
    status: data.status || "published",
    deal_type: data.deal_type || data.transaction_type || "sale",
    transaction_type: data.transaction_type || data.deal_type || "sale",
    property_type: data.property_type || "apartment",
    title_uz: data.title_uz || "",
    title_ru: data.title_ru || "",
    description_uz: data.description_uz || "",
    description_ru: data.description_ru || "",
    price: data.price || data.price_uzs || 0,
    price_uzs: data.price_uzs || data.price || 0,
    price_usd: data.price_usd || Math.round((data.price_uzs || data.price || 0) / 12850),
    currency: data.currency || "UZS",
    price_negotiable: Boolean(data.price_negotiable),
    area: data.area || data.area_sqm || 0,
    area_sqm: data.area_sqm || data.area || 0,
    living_area: data.living_area || data.living_area_sqm || null,
    area_sotikh:
      (data.property_type === "house_yard" || data.property_type === "land") &&
      data.area_sotikh &&
      Number(data.area_sotikh) > 0
        ? Number(data.area_sotikh)
        : null,
    rooms: data.rooms || 1,
    bathrooms: data.bathrooms || 1,
    floor: data.floor || data.floor_number || 1,
    floor_number: data.floor_number || data.floor || 1,
    total_floors: data.total_floors || data.floors || 1,
    floors: data.floors || data.total_floors || 1,
    renovation: data.renovation || "euro",
    furniture: Boolean(data.furniture || data.amenities?.furniture),
    parking: Boolean(data.parking || data.amenities?.parking),
    gas: Boolean(data.utilities?.gas ?? true),
    water: Boolean(data.utilities?.water ?? true),
    electricity: Boolean(data.utilities?.electricity ?? true),
    sewerage: Boolean(data.utilities?.sewerage ?? true),
    heating: Boolean(data.utilities?.heating ?? true),
    utilities: data.utilities || {},
    air_conditioning: Boolean(data.amenities?.ac || false),
    elevator: Boolean(data.amenities?.elevator || false),
    internet: Boolean(data.amenities?.internet ?? true),
    balcony: Boolean(data.amenities?.balcony || false),
    amenities: baseAmenities,
    city: "Angren",
    district: data.district || data.district_name_uz || "Markaz",
    district_name_uz: data.district_name_uz || data.district || "Markaz",
    district_name_ru: data.district_name_ru || data.district || "Центр",
    neighborhood: data.neighborhood || data.district || "Markaz",
    address: data.address || data.address_uz || "",
    address_uz: data.address_uz || data.address || "",
    address_ru: data.address_ru || data.address || "",
    latitude: lat,
    longitude: lng,
    polygon_coordinates: data.polygon || data.polygon_coordinates || null,
    photos: photos,
    images: photos,
    main_image: mainImage,
    video_url: data.video_url || null,
    contact_phone: data.contact_phone || "+998 90 123 45 67",
    contact_telegram: data.contact_telegram || data.telegram || null,
    telegram: data.telegram || data.contact_telegram || null,
    realtor_id: isValidUuid(data.realtor_id) ? data.realtor_id : null,
    views_count: data.views_count || 0,
    favorites_count: data.favorites_count || 0,
    contacts_count: data.contacts_count || 0,
    updated_at: new Date().toISOString(),
  };
}

// Fallback helper for local storage if Supabase credentials are not yet supplied
async function readCanonicalLocal(): Promise<Property[]> {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) return [];
    const content = await fs.promises.readFile(DATA_FILE_PATH, "utf8");
    return JSON.parse(content) as Property[];
  } catch {
    return [];
  }
}

async function writeCanonicalLocal(properties: Property[]): Promise<void> {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const temp = `${DATA_FILE_PATH}.tmp.${Date.now()}`;
    await fs.promises.writeFile(temp, JSON.stringify(properties, null, 2), "utf8");
    await fs.promises.rename(temp, DATA_FILE_PATH);
  } catch (e) {
    console.error("[Canonical DB] Local write error:", e);
  }
}

// =============================================================================
// CANONICAL SUPABASE PROPERTY OPERATIONS
// =============================================================================

/**
 * Fetch all published properties.
 * Public rule: ONLY status === 'published' is returned.
 * Draft and archived properties are filtered out by Supabase RLS and query filters.
 */
export async function getPublishedProperties(filters?: PropertyFilterParams): Promise<Property[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from("properties")
        .select("*, realtors(*)")
        .eq("status", "published");

      const dealType = filters?.deal_type || filters?.transaction_type;
      if (dealType && dealType !== "all") {
        query = query.or(`deal_type.eq.${dealType},transaction_type.eq.${dealType}`);
      }
      if (filters?.property_type && filters.property_type !== "all") {
        query = query.eq("property_type", filters.property_type);
      }
      if (filters?.rooms) {
        query = query.eq("rooms", filters.rooms);
      }
      if (filters?.price_min) {
        query = query.gte("price", filters.price_min);
      }
      if (filters?.price_max) {
        query = query.lte("price", filters.price_max);
      }
      if (filters?.district && filters.district !== "all") {
        query = query.or(
          `district.ilike.%${filters.district}%,district_name_uz.ilike.%${filters.district}%,neighborhood.ilike.%${filters.district}%`
        );
      }
      if (filters?.search_query) {
        const q = filters.search_query.trim();
        if (q) {
          query = query.or(
            `title_uz.ilike.%${q}%,title_ru.ilike.%${q}%,address_uz.ilike.%${q}%,address_ru.ilike.%${q}%,neighborhood.ilike.%${q}%,district_name_uz.ilike.%${q}%,district_name_ru.ilike.%${q}%`
          );
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) {
        return data.map(mapRowToProperty);
      }
      console.warn("[Supabase] getPublishedProperties error:", error?.message);
    } catch (err) {
      console.warn("[Supabase] Query exception in getPublishedProperties:", err);
    }
  }

  // Fallback if Supabase credentials are placeholders
  const all = await readCanonicalLocal();
  return all.filter((property) => {
    if (property.status !== "published") return false;
    const dealType = filters?.deal_type || filters?.transaction_type;
    if (dealType && dealType !== "all") {
      const pType = property.deal_type || property.transaction_type;
      if (pType !== dealType) return false;
    }
    if (filters?.property_type && filters.property_type !== "all") {
      if (property.property_type !== filters.property_type) return false;
    }
    if (filters?.district && filters.district !== "all") {
      const q = filters.district.toLowerCase();
      const match =
        property.district_name_uz?.toLowerCase().includes(q) ||
        property.district?.toLowerCase().includes(q) ||
        property.neighborhood?.toLowerCase().includes(q);
      if (!match) return false;
    }
    const pPrice = property.price_uzs || property.price || 0;
    if (filters?.price_min && pPrice < filters.price_min) return false;
    if (filters?.price_max && pPrice > filters.price_max) return false;
    if (filters?.rooms && property.rooms !== filters.rooms) return false;
    if (filters?.search_query) {
      const q = filters.search_query.toLowerCase().trim();
      const match =
        property.title_uz?.toLowerCase().includes(q) ||
        property.title_ru?.toLowerCase().includes(q) ||
        property.address_uz?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

/**
 * Fetch a single property by its exact canonical ID.
 */
export async function getPropertyById(
  id: string,
  options?: { useAdmin?: boolean }
): Promise<Property | null> {
  if (isSupabaseConfigured) {
    try {
      const client = options?.useAdmin ? supabaseAdmin : supabase;
      const { data, error } = await client
        .from("properties")
        .select("*, realtors(*)")
        .eq("id", id)
        .single();

      if (!error && data) {
        return mapRowToProperty(data);
      }
    } catch (err) {
      console.warn(`[Supabase] getPropertyById error for ${id}:`, err);
    }
  }

  const all = await readCanonicalLocal();
  return all.find((p) => p.id === id) || null;
}

/**
 * Fetch property by slug or ID.
 */
export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*, realtors(*)")
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .single();

      if (!error && data) {
        return mapRowToProperty(data);
      }
    } catch {}
  }

  const all = await readCanonicalLocal();
  return all.find((p) => p.slug === slug || p.id === slug) || null;
}

/**
 * Fetch all properties for Admin Panel (all statuses).
 */
export async function getAdminProperties(status?: PropertyStatus | "all"): Promise<Property[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabaseAdmin.from("properties").select("*, realtors(*)");
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) {
        return data.map(mapRowToProperty);
      }
      console.warn("[Supabase] getAdminProperties error:", error?.message);
    } catch (err) {
      console.warn("[Supabase] getAdminProperties exception:", err);
    }
  }

  const all = await readCanonicalLocal();
  if (!status || status === "all") return all;
  return all.filter((p) => p.status === status);
}

/**
 * Create a new property in the canonical database.
 */
export async function createProperty(
  data: Omit<Property, "id" | "created_at" | "slug"> & { id?: string; slug?: string }
): Promise<Property> {
  const id = data.id || `prop-${Date.now()}`;
  const slug =
    data.slug ||
    `${(data.title_uz || "obyekt")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 45)}-${Date.now().toString().slice(-6)}`;

  const now = new Date().toISOString();
  const dbPayload = mapPropertyToDb({ ...data, id, slug });
  dbPayload.created_at = now;
  dbPayload.published_at = data.status === "published" ? now : null;

  if (isSupabaseConfigured) {
    try {
      const { data: inserted, error } = await supabaseAdmin
        .from("properties")
        .insert(dbPayload)
        .select("*, realtors(*)")
        .single();

      if (!error && inserted) {
        const result = mapRowToProperty(inserted);
        // Also mirror to local file for offline resilience
        const all = await readCanonicalLocal();
        await writeCanonicalLocal([result, ...all.filter((p) => p.id !== id)]);
        return result;
      }
      console.warn("[Supabase] createProperty error:", error?.message);
    } catch (err) {
      console.warn("[Supabase] createProperty exception:", err);
    }
  }

  // Local fallback
  const createdProp = mapRowToProperty(dbPayload);
  const all = await readCanonicalLocal();
  await writeCanonicalLocal([createdProp, ...all.filter((p) => p.id !== id)]);
  return createdProp;
}

/**
 * Update an existing property in the canonical database.
 */
export async function updateProperty(
  id: string,
  updates: Partial<Property>
): Promise<Property | null> {
  // Fetch existing record to safely apply partial updates without wiping other fields
  const existing = await getPropertyById(id, { useAdmin: true });
  const base = existing || (await readCanonicalLocal()).find((p) => p.id === id);
  if (!base) return null;

  const mergedData: Property = {
    ...base,
    ...updates,
    id,
    updated_at: new Date().toISOString(),
    published_at:
      updates.status === "published" && base.status !== "published"
        ? new Date().toISOString()
        : updates.published_at || base.published_at,
  };

  const dbUpdates = mapPropertyToDb(mergedData);
  delete dbUpdates.id; // Do not overwrite primary key

  if (isSupabaseConfigured) {
    try {
      const { data: updated, error } = await supabaseAdmin
        .from("properties")
        .update(dbUpdates)
        .eq("id", id)
        .select("*, realtors(*)")
        .single();

      if (!error && updated) {
        const result = mapRowToProperty(updated);
        const all = await readCanonicalLocal();
        await writeCanonicalLocal(all.map((p) => (p.id === id ? result : p)));
        return result;
      }
      console.warn(`[Supabase] updateProperty error for ${id}:`, error?.message);
    } catch (err) {
      console.warn(`[Supabase] updateProperty exception for ${id}:`, err);
    }
  }

  // Local fallback
  const all = await readCanonicalLocal();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  all[idx] = mergedData;
  await writeCanonicalLocal(all);
  return mergedData;
}

/**
 * Update the status of a property.
 */
export async function updatePropertyStatus(
  id: string,
  status: PropertyStatus
): Promise<boolean> {
  const result = await updateProperty(id, { status });
  return result !== null;
}

/**
 * Delete a property from the canonical database.
 */
/**
 * ZERO DELETE POLICY: Hard deletion is strictly prohibited for all properties.
 * If deletion is requested, safely transition status to 'archived'.
 */
export async function deleteProperty(id: string): Promise<boolean> {
  console.warn(`[ZeroDeletePolicy] deleteProperty rejected for ${id}: Hard delete is prohibited. Archiving property.`);
  const updated = await updateProperty(id, { status: "archived" });
  return Boolean(updated);
}
