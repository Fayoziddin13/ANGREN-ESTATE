import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

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

    const mappedRealtors = (realtors || []).map((r) => {
      const locText = (r.districts && Array.isArray(r.districts) && r.districts.length > 0)
        ? r.districts.join(", ")
        : (r.location || r.location_uz || null);

      return {
        ...r,
        location: locText,
        location_uz: r.location_uz || locText,
        location_ru: r.location_ru || locText,
        photo_url: r.photo_url || r.avatar_url || null,
        avatar_url: r.avatar_url || r.photo_url || null,
        instagram_url: r.instagram_url || r.instagram || null,
        instagram: r.instagram_url || r.instagram || null,
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
