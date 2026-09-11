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

    return NextResponse.json({
      success: true,
      count: realtors?.length || 0,
      realtors: realtors || [],
    });
  } catch (error: any) {
    console.error("[Public Realtors GET] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
