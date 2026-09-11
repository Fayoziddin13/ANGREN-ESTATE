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

function sanitizeInstagramUrl(url: any): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let fullUrl = trimmed;
  if (fullUrl.startsWith("@")) {
    fullUrl = `https://instagram.com/${fullUrl.slice(1)}`;
  } else if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
    fullUrl = `https://instagram.com/${fullUrl}`;
  }
  if (!fullUrl.startsWith("https://")) {
    throw new Error("Instagram havolasi xavfsiz HTTPS protokoli bilan bo'lishi shart (masalan: https://instagram.com/username)");
  }
  try {
    const parsed = new URL(fullUrl);
    if (!parsed.hostname.includes("instagram.com")) {
      throw new Error("Faqat haqiqiy Instagram havolasi (instagram.com) qabul qilinadi");
    }
  } catch (err: any) {
    throw new Error(err.message || "Noto'g'ri Instagram havolasi");
  }
  return fullUrl;
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

    // 1. Fetch all realtors
    const { data: realtors, error } = await supabaseAdmin
      .from("realtors")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Admin Realtors GET] Query error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const realtorList = realtors || [];

    // 2. Fetch properties to aggregate assigned_properties_count per realtor
    let propertiesMap: Record<string, number> = {};
    try {
      const { data: props } = await supabaseAdmin
        .from("properties")
        .select("realtor_id");

      if (props) {
        for (const p of props) {
          if (p.realtor_id) {
            propertiesMap[p.realtor_id] = (propertiesMap[p.realtor_id] || 0) + 1;
          }
        }
      }
    } catch {
      // Non-blocking
    }

    // 3. Fetch leads to aggregate leads_count per realtor
    let leadsMap: Record<string, number> = {};
    try {
      const { data: leads } = await supabaseAdmin
        .from("leads")
        .select("realtor_id");

      if (leads) {
        for (const l of leads) {
          if (l.realtor_id) {
            leadsMap[l.realtor_id] = (leadsMap[l.realtor_id] || 0) + 1;
          }
        }
      }
    } catch {
      // Non-blocking if leads table is pending
    }

function sanitizeInstagramUrl(url: any): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let fullUrl = trimmed;
  if (fullUrl.startsWith("@")) {
    fullUrl = `https://instagram.com/${fullUrl.slice(1)}`;
  } else if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
    fullUrl = `https://instagram.com/${fullUrl}`;
  }
  if (!fullUrl.startsWith("https://")) {
    throw new Error("Instagram havolasi xavfsiz HTTPS protokoli bilan bo'lishi shart (masalan: https://instagram.com/username)");
  }
  try {
    const parsed = new URL(fullUrl);
    if (!parsed.hostname.includes("instagram.com")) {
      throw new Error("Faqat haqiqiy Instagram havolasi (instagram.com) qabul qilinadi");
    }
  } catch (err: any) {
    throw new Error(err.message || "Noto'g'ri Instagram havolasi");
  }
  return fullUrl;
}

    // 4. Attach aggregated counts
    const enrichedRealtors = realtorList.map((r) => ({
      ...r,
      photo_url: r.photo_url || r.avatar_url || null,
      avatar_url: r.avatar_url || r.photo_url || null,
      instagram_url: r.instagram_url || r.instagram || null,
      instagram: r.instagram_url || r.instagram || null,
      properties_count: propertiesMap[r.id] || 0,
      assigned_properties_count: propertiesMap[r.id] || 0,
      leads_count: leadsMap[r.id] || 0,
    }));

    const stats = {
      total: enrichedRealtors.length,
      active: enrichedRealtors.filter((r) => r.is_active).length,
      inactive: enrichedRealtors.filter((r) => !r.is_active).length,
    };

    return NextResponse.json({
      success: true,
      count: enrichedRealtors.length,
      stats,
      realtors: enrichedRealtors,
    });
  } catch (error: any) {
    console.error("[Admin Realtors GET] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      phone,
      telegram = "",
      avatar_url = null,
      photo_url = null,
      instagram_url = null,
      instagram = null,
      experience_years = 1,
      position_uz = "Yetakchi rieltor",
      position_ru = "Ведущий риелтор",
      specialization_uz = "Ko‘chmas mulk mutaxassisi",
      specialization_ru = "Специалист по недвижимости",
      districts = [],
      bio_uz = null,
      bio_ru = null,
      display_order = 0,
      is_active = true,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Rieltor ismi kiritilishi shart (name is required)" },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Telefon raqami kiritilishi shart (phone is required)" },
        { status: 400 }
      );
    }

    let validatedInstagram: string | null = null;
    try {
      validatedInstagram = sanitizeInstagramUrl(instagram_url || instagram);
    } catch (valErr: any) {
      return NextResponse.json({ success: false, error: valErr.message }, { status: 400 });
    }

    const resolvedPhoto = photo_url || avatar_url ? String(photo_url || avatar_url).trim() : null;

    const newRealtorRow: Record<string, any> = {
      name: name.trim().slice(0, 150),
      phone: phone.trim().slice(0, 50),
      telegram: telegram ? telegram.trim().slice(0, 100) : null,
      avatar_url: resolvedPhoto,
      photo_url: resolvedPhoto,
      instagram_url: validatedInstagram,
      experience_years: Math.max(Number(experience_years) || 1, 0),
      position_uz: position_uz ? position_uz.trim().slice(0, 100) : "Yetakchi rieltor",
      position_ru: position_ru ? position_ru.trim().slice(0, 100) : "Ведущий риелтор",
      specialization_uz: specialization_uz ? specialization_uz.trim().slice(0, 200) : "",
      specialization_ru: specialization_ru ? specialization_ru.trim().slice(0, 200) : "",
      districts: Array.isArray(districts) ? districts.map((d: any) => String(d).trim()).filter(Boolean) : [],
      bio_uz: bio_uz ? String(bio_uz).trim() : null,
      bio_ru: bio_ru ? String(bio_ru).trim() : null,
      display_order: Number(display_order) || 0,
      is_active: Boolean(is_active),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: createdRealtor, error } = await supabaseAdmin
      .from("realtors")
      .insert([newRealtorRow])
      .select("*")
      .single();

    if (error && (error.message.includes("photo_url") || error.message.includes("instagram_url"))) {
      // Graceful fallback if new columns not yet in remote table schema
      const fallbackRow = { ...newRealtorRow };
      delete fallbackRow.photo_url;
      delete fallbackRow.instagram_url;
      const retry = await supabaseAdmin
        .from("realtors")
        .insert([fallbackRow])
        .select("*")
        .single();
      createdRealtor = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[Admin Realtors POST] Insert error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        realtor: {
          ...createdRealtor,
          photo_url: resolvedPhoto,
          avatar_url: resolvedPhoto,
          instagram_url: validatedInstagram,
          instagram: validatedInstagram,
          assigned_properties_count: 0,
          leads_count: 0,
        },
        message: "Realtor created successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Admin Realtors POST] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
