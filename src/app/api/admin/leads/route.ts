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

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const propertyId = searchParams.get("property_id") || "";
    const realtorId = searchParams.get("realtor_id") || "";
    const dateRange = searchParams.get("date_range") || "all";
    const search = searchParams.get("search") || "";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    // 1. Build main query for leads
    let query = supabaseAdmin
      .from("leads")
      .select("*, realtor:realtors(id, name, phone, telegram, avatar_url)", { count: "exact" });

    // Status filter
    if (status && status !== "all") {
      if (status === "closed") {
        query = query.in("status", ["completed", "cancelled", "closed"]);
      } else {
        query = query.eq("status", status);
      }
    }

    // Type filter
    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    // Property filter
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    // Realtor filter
    if (realtorId) {
      query = query.eq("realtor_id", realtorId);
    }

    // Date range filter
    if (dateRange && dateRange !== "all") {
      const now = Date.now();
      let startTime: string | null = null;
      if (dateRange === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        startTime = d.toISOString();
      } else if (dateRange === "7days") {
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateRange === "30days") {
        startTime = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      if (startTime) {
        query = query.gte("created_at", startTime);
      }
    }

    // Search filter across client name, phone, message, notes, property title
    if (search.trim()) {
      const s = search.trim();
      query = query.or(
        `client_name.ilike.%${s}%,client_phone.ilike.%${s}%,message.ilike.%${s}%,notes.ilike.%${s}%,property_title.ilike.%${s}%`
      );
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: leads, error, count } = await query;

    if (error) {
      console.error("[Admin Leads GET] Query on public.leads failed:", error.message);
      if (error.code === "PGRST205" || error.message.includes("does not exist") || error.message.includes("schema cache")) {
        return NextResponse.json(
          {
            success: false,
            error: "LEADS_TABLE_MISSING",
            message: "Table public.leads does not exist in the database. Please apply migration supabase/migrations/20260910_leads_system.sql in Supabase SQL Editor.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 2. Compute aggregate KPI stats across all records in public.leads
    let stats = {
      total: 0,
      new: 0,
      contacted: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      phone: 0,
      telegram: 0,
    };

    try {
      const { data: allStats, error: statsError } = await supabaseAdmin
        .from("leads")
        .select("status, type");

      if (!statsError && allStats) {
        stats.total = allStats.length;
        for (const item of allStats) {
          if (item.status === "new") stats.new++;
          else if (item.status === "contacted") stats.contacted++;
          else if (item.status === "in_progress") stats.in_progress++;
          else if (item.status === "completed" || item.status === "closed") stats.completed++;
          else if (item.status === "cancelled") stats.cancelled++;

          if (item.type === "phone") stats.phone++;
          else if (item.type === "telegram") stats.telegram++;
        }
      }
    } catch {
      // Non-blocking stats calculation
    }

    return NextResponse.json({
      success: true,
      count: leads?.length || 0,
      total: count ?? leads?.length ?? 0,
      stats,
      leads: leads || [],
    });
  } catch (error: any) {
    console.error("[Admin Leads GET] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
