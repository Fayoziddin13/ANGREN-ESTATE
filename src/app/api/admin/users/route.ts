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

    // 1. Fetch Supabase Auth users from auth.users (covers all Google and email registered accounts)
    let authUsers: any[] = [];
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
      if (!authErr && authData?.users) {
        authUsers = authData.users;
      }
    } catch (authFetchErr) {
      console.warn("[Admin Users API] Error fetching auth.users:", authFetchErr);
    }

    // 2. Fetch public.profiles
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesErr) {
      console.warn("[Admin Users API] Error fetching profiles:", profilesErr);
    }

    // 3. Fetch Telegram users registry from app_settings (telegram_users_registry)
    let telegramSubscribers: any[] = [];
    try {
      const { data: regRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "telegram_users_registry")
        .maybeSingle();

      if (Array.isArray(regRow?.value)) {
        telegramSubscribers = regRow.value;
      }
    } catch (regErr) {
      console.warn("[Admin Users API] Error reading telegram_users_registry from app_settings:", regErr);
    }

    // Secondary fallback: check telegram_users table if it exists
    if (telegramSubscribers.length === 0) {
      try {
        const { data: tgUsersTable } = await supabaseAdmin
          .from("telegram_users")
          .select("*")
          .order("created_at", { ascending: false });

        if (Array.isArray(tgUsersTable)) {
          telegramSubscribers = tgUsersTable;
        }
      } catch {}
    }

    // 4. Fetch leads for application tracking
    const { data: allLeads } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    const leadsList: Lead[] = (allLeads as Lead[]) || [];

    // 5. Fetch favorites count
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

    // 6. Fetch analytics views count
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

    // Build index of profiles by id, email, and phone
    const profileById = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    const profileByPhone = new Map<string, any>();

    for (const p of profiles || []) {
      if (p.id) profileById.set(p.id, p);
      if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
      const normP = normalizePhone(p.phone);
      if (normP) profileByPhone.set(normP, p);
    }

    // Build index of telegram subscribers by id and phone
    const tgSubById = new Map<number, any>();
    const tgSubByPhone = new Map<string, any>();

    for (const sub of telegramSubscribers) {
      const numId = Number(sub.telegram_user_id || sub.id);
      if (numId) tgSubById.set(numId, sub);
      const norm = normalizePhone(sub.phone);
      if (norm) tgSubByPhone.set(norm, sub);
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

    const seenUserIds = new Set<string>();
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const seenTgUserIds = new Set<number>();
    const allUsers: RegisteredUser[] = [];

    // --- PHASE 1: Process auth.users (Google & Email users) ---
    for (const au of authUsers) {
      const userId = au.id;
      seenUserIds.add(userId);
      if (au.email) seenEmails.add(au.email.toLowerCase());

      const profile = profileById.get(userId) || (au.email ? profileByEmail.get(au.email.toLowerCase()) : null);

      // Determine registration source
      const isGoogle =
        profile?.auth_provider === "google" ||
        au.app_metadata?.provider === "google" ||
        au.app_metadata?.providers?.includes("google") ||
        au.user_metadata?.iss?.includes("google") ||
        Boolean(profile?.google_id) ||
        Boolean(au.user_metadata?.avatar_url?.includes("googleusercontent")) ||
        Boolean(au.user_metadata?.picture?.includes("googleusercontent"));

      const isTg = profile?.auth_provider === "telegram" || String(userId).startsWith("tg_");

      let regSource: "google" | "telegram" | "other" = "other";
      if (isGoogle) regSource = "google";
      else if (isTg) regSource = "telegram";

      // Resolve phone
      const phone = profile?.phone || au.phone || au.user_metadata?.phone || undefined;
      const normP = normalizePhone(phone);
      if (normP) seenPhones.add(normP);

      // Resolve Telegram connectivity
      let tgUserId: number | undefined = profile?.telegram_user_id ? Number(profile.telegram_user_id) : undefined;
      let tgUsername: string | undefined = profile?.telegram_username || undefined;

      if (!tgUserId && normP && tgSubByPhone.has(normP)) {
        const sub = tgSubByPhone.get(normP);
        tgUserId = Number(sub.telegram_user_id);
        if (!tgUsername && sub.username) tgUsername = sub.username;
      }
      if (tgUserId) seenTgUserIds.add(tgUserId);

      // Resolve Google ID
      const googleId = profile?.google_id || au.user_metadata?.sub || (isGoogle ? au.id : undefined);

      // Resolve Name
      const name =
        profile?.full_name ||
        au.user_metadata?.full_name ||
        au.user_metadata?.name ||
        (au.email ? au.email.split("@")[0] : "Foydalanuvchi");

      // Resolve avatar
      const avatarUrl =
        profile?.avatar_url ||
        au.user_metadata?.avatar_url ||
        au.user_metadata?.picture ||
        undefined;

      const userLeads = findUserLeads(userId, tgUserId, phone);
      const applications = userLeads.filter(isActualApplication);

      allUsers.push({
        id: userId,
        name: name,
        email: au.email || profile?.email || "",
        phone: phone,
        avatar_url: avatarUrl,
        role: profile?.role === "admin" ? "admin" : "user",
        registration_source: regSource,
        registration_date: profile?.created_at || au.created_at || new Date().toISOString(),
        last_activity: profile?.last_activity || au.last_sign_in_at || profile?.updated_at || au.created_at || new Date().toISOString(),
        telegram_user_id: tgUserId,
        telegram_username: tgUsername,
        google_id: googleId,
        has_submitted_application: applications.length > 0,
        applications_count: applications.length,
        applications: applications,
        can_message_telegram: Boolean(tgUserId),
        favorites_count: favoritesCountMap.get(userId) || 0,
        viewed_properties_count: viewsCountMap.get(userId) || 0,
        status: profile?.status === "disabled" ? "disabled" : "active",
      });
    }

    // --- PHASE 2: Process profiles that might not have been in auth.users ---
    for (const p of profiles || []) {
      if (seenUserIds.has(p.id) || (p.email && seenEmails.has(p.email.toLowerCase()))) {
        continue;
      }
      seenUserIds.add(p.id);
      if (p.email) seenEmails.add(p.email.toLowerCase());

      const isTelegramId = String(p.id).startsWith("tg_");
      let tgUserId: number | undefined = p.telegram_user_id ? Number(p.telegram_user_id) : undefined;
      let tgUsername: string | undefined = p.telegram_username || undefined;

      if (!tgUserId && isTelegramId) {
        const parsed = parseInt(p.id.replace("tg_", ""), 10);
        if (!isNaN(parsed)) tgUserId = parsed;
      }

      const normP = normalizePhone(p.phone);
      if (normP) seenPhones.add(normP);

      if ((!tgUserId || !tgUsername) && normP && tgSubByPhone.has(normP)) {
        const matchedSub = tgSubByPhone.get(normP);
        if (!tgUserId && matchedSub.telegram_user_id) tgUserId = Number(matchedSub.telegram_user_id);
        if (!tgUsername && matchedSub.username) tgUsername = matchedSub.username;
      }
      if (tgUserId) seenTgUserIds.add(tgUserId);

      let regSource: "google" | "telegram" | "other" = "other";
      if (p.auth_provider === "telegram" || isTelegramId || (tgUserId && !p.google_id && p.auth_provider !== "google")) {
        regSource = "telegram";
      } else if (p.auth_provider === "google" || p.google_id || p.avatar_url?.includes("googleusercontent")) {
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

    // --- PHASE 3: Process telegram_users_registry from app_settings (with deduplication) ---
    for (const sub of telegramSubscribers) {
      const tgNum = Number(sub.telegram_user_id || sub.id);
      if (!tgNum) continue;

      const normP = normalizePhone(sub.phone);

      // Check if this Telegram subscriber already matches an existing user
      if (seenTgUserIds.has(tgNum)) {
        continue;
      }

      if (normP && seenPhones.has(normP)) {
        // Link to existing user record with same phone instead of duplicating
        const existingUser = allUsers.find((u) => u.phone && normalizePhone(u.phone) === normP);
        if (existingUser) {
          existingUser.telegram_user_id = tgNum;
          if (!existingUser.telegram_username && sub.username) {
            existingUser.telegram_username = sub.username;
          }
          existingUser.can_message_telegram = true;
          seenTgUserIds.add(tgNum);
          continue;
        }
      }

      // Add as unique Telegram registered user
      const syntheticId = `tg_${tgNum}`;
      seenUserIds.add(syntheticId);
      seenTgUserIds.add(tgNum);
      if (normP) seenPhones.add(normP);

      const tgFullName =
        [sub.first_name, sub.last_name].filter(Boolean).join(" ") ||
        sub.username ||
        "Telegram foydalanuvchisi";

      const userLeads = findUserLeads(syntheticId, tgNum, sub.phone);
      const applications = userLeads.filter(isActualApplication);

      allUsers.push({
        id: syntheticId,
        name: tgFullName,
        email: sub.username ? `@${sub.username}` : `tg_${tgNum}@angrenestate.uz`,
        phone: sub.phone || undefined,
        avatar_url: undefined,
        role: "user",
        registration_source: "telegram",
        registration_date: sub.registered_at || sub.created_at || new Date().toISOString(),
        last_activity: sub.updated_at || sub.registered_at || sub.created_at || new Date().toISOString(),
        telegram_user_id: tgNum,
        telegram_username: sub.username || undefined,
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
