import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getRealtorsMeta } from "@/lib/realtorMetaStore";

export const dynamic = "force-dynamic";

/**
 * Public Realtors API
 * Returns only active realtors (is_active = true) for public display.
 * Inactive realtors and their personal contact info are strictly excluded.
 */
export async function GET(request: NextRequest) {
  try {
    const { data: realtors, error } = await supabaseAdmin
      .from("realtors")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Public Realtors GET] Error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const metaMap = await getRealtorsMeta();

    const mappedRealtors = (realtors || []).map((r) => {
      const extra = metaMap[r.id] || {};
      const locText = (r.districts && Array.isArray(r.districts) && r.districts.length > 0)
        ? r.districts.join(", ")
        : (r.location || r.location_uz || null);

      const insta = r.instagram_url || r.instagram || extra.instagram_url || null;
      const photo = r.photo_url || r.avatar_url || extra.photo_url || null;

      return {
        ...r,
        location: locText,
        location_uz: r.location_uz || locText,
        location_ru: r.location_ru || locText,
        photo_url: photo,
        avatar_url: photo,
        instagram_url: insta,
        instagram: insta,
      };
    });

    return NextResponse.json({
      success: true,
      count: mappedRealtors.length,
      realtors: mappedRealtors,
    });
  } catch (error: any) {
    console.error("[Public Realtors GET] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
