import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session) return session;

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session) {
      return verified.session;
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }

    const { id } = params;
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("realtor_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      // If table leads is not yet created, return empty array gracefully
      if (error.code === "PGRST205" || error.message.includes("does not exist")) {
        return NextResponse.json({ success: true, count: 0, leads: [] });
      }
      console.error("[Realtor Leads GET] Query error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: leads?.length || 0,
      leads: leads || [],
    });
  } catch (error: any) {
    console.error("[Realtor Leads GET] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
