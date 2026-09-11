import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { RegisteredUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminSession = await getAdminSessionServer();
    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = searchParams.get("status") || "all";

    // Fetch all profiles from Supabase
    let query = supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: profiles, error } = await query;

    if (error) {
      console.error("[Admin Users API] Error fetching profiles:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Fetch all favorites to calculate favorites_count per user
    const { data: allFavorites } = await supabaseAdmin
      .from("favorites")
      .select("user_id");

    const favoritesCountMap = new Map<string, number>();
    if (allFavorites) {
      for (const fav of allFavorites) {
        if (fav.user_id) {
          favoritesCountMap.set(
            fav.user_id,
            (favoritesCountMap.get(fav.user_id) || 0) + 1
          );
        }
      }
    }

    // Fetch property_view events to calculate viewed_properties_count per user
    const { data: allViews } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id")
      .eq("event_type", "property_view");

    const viewsCountMap = new Map<string, number>();
    if (allViews) {
      for (const v of allViews) {
        if (v.user_id) {
          viewsCountMap.set(
            v.user_id,
            (viewsCountMap.get(v.user_id) || 0) + 1
          );
        }
      }
    }

    // Map profiles to RegisteredUser interface
    const allUsers: RegisteredUser[] = (profiles || []).map((p: any) => {
      const userStatus: "active" | "disabled" = p.status === "disabled" ? "disabled" : "active";
      const userRole: "admin" | "user" = p.role === "admin" ? "admin" : "user";
      return {
        id: p.id,
        name: p.full_name || (p.email ? p.email.split("@")[0] : "Foydalanuvchi"),
        email: p.email || "",
        avatar_url: p.avatar_url || undefined,
        role: userRole,
        registration_date: p.created_at || new Date().toISOString(),
        last_activity: p.last_activity || p.updated_at || p.created_at || new Date().toISOString(),
        favorites_count: favoritesCountMap.get(p.id) || 0,
        viewed_properties_count: viewsCountMap.get(p.id) || 0,
        status: userStatus,
      };
    });

    const activeCount = allUsers.filter((u) => u.status === "active").length;
    const disabledCount = allUsers.filter((u) => u.status === "disabled").length;

    // Filter by status and search query
    let filteredUsers = allUsers;
    if (statusFilter !== "all") {
      filteredUsers = filteredUsers.filter((u) => u.status === statusFilter);
    }
    if (searchQuery) {
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery) ||
          u.email.toLowerCase().includes(searchQuery)
      );
    }

    return NextResponse.json({
      success: true,
      users: filteredUsers,
      total: allUsers.length,
      activeCount,
      disabledCount,
    });
  } catch (err: any) {
    console.error("[Admin Users API] Exception:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
