import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { calculatePolygonCentroid, DEFAULT_ANGREN_HUDUDS } from "@/lib/hududService";
import { HududItem } from "@/lib/types";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session && session.role === "admin") return session;

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session && verified.session.role === "admin") {
      return verified.session;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name_uz, name_ru, coordinates } = body;

    if (!name_uz || typeof name_uz !== "string" || !name_uz.trim()) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Hudud nomi (uz) kiritilishi shart" },
        { status: 400 }
      );
    }

    if (!Array.isArray(coordinates) || coordinates.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Poligon kamida 3 ta koordinatadan iborat bo‘lishi shart",
        },
        { status: 400 }
      );
    }

    // Ensure polygon is closed (first point equals last point)
    const closedCoords: [number, number][] = [...coordinates];
    if (
      closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
      closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]
    ) {
      closedCoords.push(closedCoords[0]);
    }

    const rawId =
      body.id ||
      name_uz
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const hududId = rawId || `hudud-${Date.now()}`;
    const centroid = calculatePolygonCentroid(closedCoords);

    // 1. Insert or update in districts table (using Point centroid for PostGIS compliance)
    const districtPayload = {
      id: hududId,
      city_id: "angren",
      name_uz: name_uz.trim(),
      name_ru: (name_ru || name_uz).trim(),
      latitude: centroid.lat,
      longitude: centroid.lng,
      geom: {
        type: "Point",
        crs: { type: "name", properties: { name: "EPSG:4326" } },
        coordinates: [centroid.lng, centroid.lat],
      },
      display_order: body.display_order || 50,
      created_at: new Date().toISOString(),
    };

    const { error: distErr } = await supabaseAdmin
      .from("districts")
      .upsert([districtPayload], { onConflict: "id" });

    if (distErr) {
      console.error("[Admin Hududs] Error inserting into districts:", distErr);
      return NextResponse.json(
        { success: false, error: "STORAGE_ERROR", message: distErr.message },
        { status: 500 }
      );
    }

    // 2. Persist polygon vertices in app_settings under 'hudud_polygons'
    const { data: existingSettings } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "hudud_polygons")
      .maybeSingle();

    const existingMap =
      existingSettings?.value && typeof existingSettings.value === "object"
        ? existingSettings.value
        : {};

    const updatedMap = {
      ...existingMap,
      [hududId]: {
        coordinates: closedCoords,
        name_uz: name_uz.trim(),
        name_ru: (name_ru || name_uz).trim(),
        updated_at: new Date().toISOString(),
      },
    };

    await supabaseAdmin.from("app_settings").upsert({
      key: "hudud_polygons",
      value: updatedMap,
      updated_at: new Date().toISOString(),
    });

    const newHudud: HududItem = {
      id: hududId,
      city_id: "angren",
      name_uz: name_uz.trim(),
      name_ru: (name_ru || name_uz).trim(),
      latitude: centroid.lat,
      longitude: centroid.lng,
      coordinates: closedCoords,
      created_at: districtPayload.created_at,
    };

    return NextResponse.json({ success: true, hudud: newHudud }, { status: 201 });
  } catch (err: any) {
    console.error("[Admin Hududs] Exception:", err);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}

async function getHududAssignedPropertyCount(targetId: string): Promise<number> {
  const cleanTarget = targetId.trim().toLowerCase();
  if (!cleanTarget) return 0;

  // 1. Identify district record to match both its id, name_uz, and name_ru
  let distId = cleanTarget;
  let distNameUz = "";
  let distNameRu = "";

  try {
    const { data: districts } = await supabaseAdmin
      .from("districts")
      .select("id, name_uz, name_ru");

    if (Array.isArray(districts)) {
      const match = districts.find(
        (d) =>
          (d.id && d.id.toLowerCase().trim() === cleanTarget) ||
          (d.name_uz && d.name_uz.toLowerCase().trim() === cleanTarget) ||
          (d.name_ru && d.name_ru.toLowerCase().trim() === cleanTarget)
      );
      if (match) {
        distId = (match.id || "").toLowerCase().trim();
        distNameUz = (match.name_uz || "").toLowerCase().trim();
        distNameRu = (match.name_ru || "").toLowerCase().trim();
      }
    }
  } catch (err) {
    console.warn("[Admin Hududs] Error fetching district details:", err);
  }

  const matchSet = new Set<string>();
  if (cleanTarget) matchSet.add(cleanTarget);
  if (distId) matchSet.add(distId);
  if (distNameUz) matchSet.add(distNameUz);
  if (distNameRu) matchSet.add(distNameRu);

  // 2. Query properties from Supabase
  try {
    const { data: properties, error: pErr } = await supabaseAdmin
      .from("properties")
      .select("id, district, district_name_uz, amenities");

    if (!pErr && Array.isArray(properties)) {
      const matched = properties.filter((p: any) => {
        const pDistrict = String(p.district || "").toLowerCase().trim();
        const pDistrictNameUz = String(p.district_name_uz || "").toLowerCase().trim();
        const pHududId = String((p.amenities as any)?.hudud_id || "").toLowerCase().trim();
        const pDistrictId = String((p.amenities as any)?.district_id || "").toLowerCase().trim();

        return (
          matchSet.has(pDistrict) ||
          matchSet.has(pDistrictNameUz) ||
          matchSet.has(pHududId) ||
          matchSet.has(pDistrictId)
        );
      });
      return matched.length;
    }
  } catch (err) {
    console.warn("[Admin Hududs] Error querying properties from Supabase:", err);
  }

  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkUsageId = searchParams.get("check_usage") || searchParams.get("usage_id");

    if (checkUsageId) {
      const assignedCount = await getHududAssignedPropertyCount(checkUsageId);

      return NextResponse.json({
        success: true,
        in_use: assignedCount > 0,
        count: assignedCount,
      });
    }

    // Default: fetch hududs
    const { data: districts, error: distErr } = await supabaseAdmin
      .from("districts")
      .select("*")
      .order("display_order", { ascending: true });

    if (distErr) {
      return NextResponse.json({ success: false, error: distErr.message }, { status: 500 });
    }

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "hudud_polygons")
      .maybeSingle();

    const polygonsMap = settings?.value && typeof settings.value === "object" ? settings.value : {};

    const hududs: HududItem[] = (districts || []).map((d) => {
      const defaultMatch = DEFAULT_ANGREN_HUDUDS.find(
        (def) =>
          def.id.toLowerCase() === (d.id || "").toLowerCase() ||
          def.name_uz.toLowerCase() === (d.name_uz || "").toLowerCase()
      );
      return {
        id: d.id,
        city_id: d.city_id,
        name_uz: d.name_uz,
        name_ru: d.name_ru || d.name_uz,
        latitude: d.latitude,
        longitude: d.longitude,
        coordinates: polygonsMap[d.id]?.coordinates || defaultMatch?.coordinates || undefined,
        display_order: d.display_order,
        created_at: d.created_at,
        mahallas: defaultMatch?.mahallas || [],
      };
    });

    return NextResponse.json({ success: true, hududs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name_uz, name_ru, coordinates } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Hudud ID ko‘rsatilishi shart" },
        { status: 400 }
      );
    }

    if (!name_uz || typeof name_uz !== "string" || !name_uz.trim()) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Hudud nomi (uz) kiritilishi shart" },
        { status: 400 }
      );
    }

    if (!Array.isArray(coordinates) || coordinates.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Poligon kamida 3 ta koordinatadan iborat bo‘lishi shart",
        },
        { status: 400 }
      );
    }

    const closedCoords: [number, number][] = [...coordinates];
    if (
      closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
      closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]
    ) {
      closedCoords.push(closedCoords[0]);
    }

    const centroid = calculatePolygonCentroid(closedCoords);

    // 1. Update districts table
    const { error: distErr } = await supabaseAdmin
      .from("districts")
      .update({
        name_uz: name_uz.trim(),
        name_ru: (name_ru || name_uz).trim(),
        latitude: centroid.lat,
        longitude: centroid.lng,
        geom: {
          type: "Point",
          crs: { type: "name", properties: { name: "EPSG:4326" } },
          coordinates: [centroid.lng, centroid.lat],
        },
      })
      .eq("id", id);

    if (distErr) {
      return NextResponse.json(
        { success: false, error: "STORAGE_ERROR", message: distErr.message },
        { status: 500 }
      );
    }

    // 2. Update polygon vertices in app_settings
    const { data: existingSettings } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "hudud_polygons")
      .maybeSingle();

    const existingMap =
      existingSettings?.value && typeof existingSettings.value === "object"
        ? existingSettings.value
        : {};

    const updatedMap = {
      ...existingMap,
      [id]: {
        coordinates: closedCoords,
        name_uz: name_uz.trim(),
        name_ru: (name_ru || name_uz).trim(),
        updated_at: new Date().toISOString(),
      },
    };

    await supabaseAdmin.from("app_settings").upsert({
      key: "hudud_polygons",
      value: updatedMap,
      updated_at: new Date().toISOString(),
    });

    const updatedHudud: HududItem = {
      id,
      city_id: "angren",
      name_uz: name_uz.trim(),
      name_ru: (name_ru || name_uz).trim(),
      latitude: centroid.lat,
      longitude: centroid.lng,
      coordinates: closedCoords,
    };

    return NextResponse.json({ success: true, hudud: updatedHudud });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID_REQUIRED" }, { status: 400 });
    }

    // Check if any properties are linked to this hudud
    const assignedCount = await getHududAssignedPropertyCount(id);

    if (assignedCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "HUDUD_IN_USE",
          message: "Bu hududda mavjud obyektlar mavjud. Avval obyektlarni boshqa hududga o‘tkazing.",
          assigned_count: assignedCount,
        },
        { status: 400 }
      );
    }

    await Promise.all([
      supabaseAdmin.from("districts").delete().eq("id", id),
      // Clean from app_settings
      (async () => {
        const { data: current } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "hudud_polygons")
          .maybeSingle();
        if (current?.value && typeof current.value === "object") {
          const updated = { ...current.value };
          delete updated[id];
          await supabaseAdmin.from("app_settings").upsert({
            key: "hudud_polygons",
            value: updated,
            updated_at: new Date().toISOString(),
          });
        }
      })(),
    ]);

    return NextResponse.json({ success: true, deleted_id: id });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}
