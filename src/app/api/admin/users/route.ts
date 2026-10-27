import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { RegisteredUser, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

function isActualApplication(lead: any): boolean {
  if (lead.type === "property_listing_request") return true;
  if (lead.metadata?.lead_type === "property_listing_request") return true;
  if (lead.property_id != null) return true;
  if (lead.type === "inquiry") return true;
  if (lead.metadata?.deal_type || lead.metadata?.property_type) return true;
  if (lead.metadata?.registration_step === "contact_shared") return false;
  if (lead.type === "telegram" && (!lead.message || lead.message.includes("kontaktini yubordi"))) return false;
  return Boolean(lead.message && lead.message.trim().length > 0);
}

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  return p.replace(/[\s\(\)\-\+]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const adminSession = await getAdminSessionServer();
    if (!adminSession || adminSession.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = searchParams.get("status") || "all";
    const sourceFilter = searchParams.get("source") || "all";
    const applicationFilter = searchParams.get("application") || "all";

    // 1. Fetch profiles
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesErr) {
      console.error("[Admin Users API] Error fetching profiles:", profilesErr);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // 2. Fetch telegram_users
    const { data: telegramUsers } = await supabaseAdmin
      .from("telegram_users")
      .select("*")
      .order("created_at", { ascending: false });

    // 3. Fetch leads for application tracking
    const { data: allLeads } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    const leadsList: Lead[] = (allLeads as Lead[]) || [];

    // 4. Fetch favorites count
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

    // 5. Fetch analytics views count
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

    // Index telegram_users by telegram_user_id and phone
    const tgUserById = new Map<number, any>();
    const tgUserByPhone = new Map<string, any>();
    if (telegramUsers) {
      for (const tg of telegramUsers) {
        if (tg.telegram_user_id) {
          tgUserById.set(Number(tg.telegram_user_id), tg);
        }
        const norm = normalizePhone(tg.phone);
        if (norm) {
          tgUserByPhone.set(norm, tg);
        }
      }
    }

    // Group leads by user_id, telegram_user_id, and phone
    const leadsByUserId = new Map<string, Lead[]>();
    const leadsByTgId = new Map<number, Lead[]>();
    const leadsByPhone = new Map<string, Lead[]>();

    for (const l of leadsList) {
      const meta = l.metadata || {};
      const uId = meta.user_id;
      if (uId) {
        const arr = leadsByUserId.get(uId) || [];
        arr.push(l);
        leadsByUserId.set(uId, arr);
      }

      const tgId = meta.telegram_user_id || (l.ip_hash?.startsWith("tg_") ? Number(l.ip_hash.replace("tg_", "")) : null);
      if (tgId && !isNaN(Number(tgId))) {
        const numTgId = Number(tgId);
        const arr = leadsByTgId.get(numTgId) || [];
        arr.push(l);
        leadsByTgId.set(numTgId, arr);
      }

      const phoneNorm = normalizePhone(l.client_phone);
      if (phoneNorm) {
        const arr = leadsByPhone.get(phoneNorm) || [];
        arr.push(l);
        leadsByPhone.set(phoneNorm, arr);
      }
    }

    const seenUserIds = new Set<string>();
    const allUsers: RegisteredUser[] = [];

    // Helper to extract leads for a specific user
    const findUserLeads = (userId: string, tgId?: number, phone?: string): Lead[] => {
      const leadMap = new Map<string, Lead>();
      if (userId && leadsByUserId.has(userId)) {
        for (const l of leadsByUserId.get(userId)!) leadMap.set(l.id, l);
      }
      if (tgId && leadsByTgId.has(tgId)) {
        for (const l of leadsByTgId.get(tgId)!) leadMap.set(l.id, l);
      }
      const normP = normalizePhone(phone);
      if (normP && leadsByPhone.has(normP)) {
        for (const l of leadsByPhone.get(normP)!) leadMap.set(l.id, l);
      }
      return Array.from(leadMap.values());
    };

    // 6. Map profiles
    for (const p of profiles || []) {
      seenUserIds.add(p.id);

      const isTelegramId = String(p.id).startsWith("tg_");
      let tgUserId: number | undefined = p.telegram_user_id ? Number(p.telegram_user_id) : undefined;
      let tgUsername: string | undefined = p.telegram_username || undefined;

      if (!tgUserId && isTelegramId) {
        const parsed = parseInt(p.id.replace("tg_", ""), 10);
        if (!isNaN(parsed)) tgUserId = parsed;
      }

      // If phone matches a telegram user, augment telegram info
      const normPhone = normalizePhone(p.phone);
      if ((!tgUserId || !tgUsername) && normPhone && tgUserByPhone.has(normPhone)) {
        const matchedTg = tgUserByPhone.get(normPhone);
        if (!tgUserId && matchedTg.telegram_user_id) tgUserId = Number(matchedTg.telegram_user_id);
        if (!tgUsername && matchedTg.username) tgUsername = matchedTg.username;
      }

      let regSource: "google" | "telegram" | "other" = "other";
      if (p.auth_provider === "telegram" || isTelegramId || (tgUserId && !p.google_id && !p.email?.includes("@gmail.com"))) {
        regSource = "telegram";
      } else if (p.auth_provider === "google" || p.google_id || p.email?.includes("@gmail.com") || p.avatar_url?.includes("googleusercontent")) {
        regSource = "google";
      } else if (tgUserId) {
        regSource = "telegram";
      }

      const userLeads = findUserLeads(p.id, tgUserId, p.phone);
      const applications = userLeads.filter(isActualApplication);

      allUsers.push({
        id: p.id,
        name: p.full_name || (p.email ? p.email.split("@")[0] : tgUsername ? `@${tgUsername}` : "Foydalanuvchi"),
        email: p.email || (tgUsername ? `@${tgUsername}` : ""),
        phone: p.phone || undefined,
        avatar_url: p.avatar_url || undefined,
        role: p.role === "admin" ? "admin" : "user",
        registration_source: regSource,
        registration_date: p.created_at || new Date().toISOString(),
        last_activity: p.last_activity || p.updated_at || p.created_at || new Date().toISOString(),
        telegram_user_id: tgUserId,
        telegram_username: tgUsername,
        google_id: p.google_id || undefined,
        has_submitted_application: applications.length > 0,
        applications_count: applications.length,
        applications: applications,
        can_message_telegram: Boolean(tgUserId),
        favorites_count: favoritesCountMap.get(p.id) || 0,
        viewed_properties_count: viewsCountMap.get(p.id) || 0,
        status: p.status === "disabled" ? "disabled" : "active",
      });
    }

    // 7. Include telegram_users who are not in profiles yet
    if (telegramUsers) {
      for (const tg of telegramUsers) {
        const syntheticId = `tg_${tg.telegram_user_id}`;
        if (!seenUserIds.has(syntheticId)) {
          // Check if already represented by phone
          const normP = normalizePhone(tg.phone);
          const alreadyIn = allUsers.some(
            (u) =>
              u.telegram_user_id === Number(tg.telegram_user_id) ||
              (normP && normalizePhone(u.phone) === normP)
          );

          if (!alreadyIn) {
            seenUserIds.add(syntheticId);
            const tgFullName = [tg.first_name, tg.last_name].filter(Boolean).join(" ") || tg.username || "Telegram User";
            const userLeads = findUserLeads(syntheticId, Number(tg.telegram_user_id), tg.phone);
            const applications = userLeads.filter(isActualApplication);

            allUsers.push({
              id: syntheticId,
              name: tgFullName,
              email: tg.username ? `@${tg.username}` : `tg_${tg.telegram_user_id}@angrenestate.uz`,
              phone: tg.phone || undefined,
              avatar_url: undefined,
              role: "user",
              registration_source: "telegram",
              registration_date: tg.created_at || new Date().toISOString(),
              last_activity: tg.last_active_at || tg.updated_at || tg.created_at || new Date().toISOString(),
              telegram_user_id: Number(tg.telegram_user_id),
              telegram_username: tg.username || undefined,
              google_id: undefined,
              has_submitted_application: applications.length > 0,
              applications_count: applications.length,
              applications: applications,
              can_message_telegram: true,
              favorites_count: 0,
              viewed_properties_count: 0,
              status: "active",
            });
          }
        }
      }
    }

    // Calculate overall stats before filtering
    const totalCount = allUsers.length;
    const activeCount = allUsers.filter((u) => u.status === "active").length;
    const disabledCount = allUsers.filter((u) => u.status === "disabled").length;
    const googleCount = allUsers.filter((u) => u.registration_source === "google").length;
    const telegramCount = allUsers.filter((u) => u.registration_source === "telegram").length;
    const withApplicationCount = allUsers.filter((u) => u.has_submitted_application).length;

    // Apply Filters
    let filteredUsers = allUsers;

    if (statusFilter !== "all") {
      filteredUsers = filteredUsers.filter((u) => u.status === statusFilter);
    }

    if (sourceFilter !== "all") {
      filteredUsers = filteredUsers.filter((u) => u.registration_source === sourceFilter);
    }

    if (applicationFilter === "has_application") {
      filteredUsers = filteredUsers.filter((u) => u.has_submitted_application);
    } else if (applicationFilter === "no_application") {
      filteredUsers = filteredUsers.filter((u) => !u.has_submitted_application);
    }

    if (searchQuery) {
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchQuery) ||
          u.email.toLowerCase().includes(searchQuery) ||
          (u.phone && u.phone.toLowerCase().includes(searchQuery)) ||
          (u.telegram_username && u.telegram_username.toLowerCase().includes(searchQuery)) ||
          (u.telegram_user_id && String(u.telegram_user_id).includes(searchQuery)) ||
          (u.google_id && u.google_id.toLowerCase().includes(searchQuery))
      );
    }

    return NextResponse.json({
      success: true,
      users: filteredUsers,
      total: totalCount,
      activeCount,
      disabledCount,
      googleCount,
      telegramCount,
      withApplicationCount,
    });
  } catch (err: any) {
    console.error("[Admin Users API] Exception:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
