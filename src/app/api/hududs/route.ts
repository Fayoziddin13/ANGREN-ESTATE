import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { DEFAULT_ANGREN_HUDUDS } from "@/lib/hududService";
import { HududItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [districtsRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("districts").select("*").order("display_order", { ascending: true }),
      supabaseAdmin.from("app_settings").select("value").eq("key", "hudud_polygons").maybeSingle(),
    ]);

    const polygonMap: Record<string, [number, number][]> =
      settingsRes.data?.value && typeof settingsRes.data.value === "object"
        ? Object.fromEntries(
            Object.entries(settingsRes.data.value).map(([k, v]: [string, any]) => [
              k,
              Array.isArray(v) ? v : v?.coordinates || [],
            ])
          )
        : {};

    // Also populate default polygons for known districts if not already overridden
    for (const def of DEFAULT_ANGREN_HUDUDS) {
      if (!polygonMap[def.id] && def.coordinates) {
        polygonMap[def.id] = def.coordinates;
      }
    }

    if (districtsRes.data && districtsRes.data.length > 0) {
      const hududs: HududItem[] = districtsRes.data.map((d: any) => {
        const defaultMatch = DEFAULT_ANGREN_HUDUDS.find(
          (def) =>
            def.id.toLowerCase() === (d.id || "").toLowerCase() ||
            def.name_uz.toLowerCase() === (d.name_uz || "").toLowerCase()
        );
        return {
          id: d.id,
          city_id: d.city_id || "angren",
          name_uz: d.name_uz || d.id,
          name_ru: d.name_ru || d.name_uz || d.id,
          latitude: Number(d.latitude || 41.0167),
          longitude: Number(d.longitude || 70.1436),
          display_order: d.display_order ?? 99,
          created_at: d.created_at,
          coordinates: polygonMap[d.id] || polygonMap[d.name_uz] || defaultMatch?.coordinates || undefined,
          mahallas: defaultMatch?.mahallas || [],
        };
      });

      return NextResponse.json({ success: true, hududs });
    }

    // Fallback to canonical default Angren hududs
    return NextResponse.json({ success: true, hududs: DEFAULT_ANGREN_HUDUDS });
  } catch (err: any) {
    console.error("[Hududs API] Error fetching hududs:", err);
    return NextResponse.json(
      { success: true, hududs: DEFAULT_ANGREN_HUDUDS, fallback: true },
      { status: 200 }
    );
  }
}
