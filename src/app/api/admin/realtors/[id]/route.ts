import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { saveRealtorMeta, getRealtorsMeta } from "@/lib/realtorMetaStore";

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

/**
 * Admin Realtor Update Endpoint (Edit, Photo, Instagram & is_active Toggle)
 * STRICT ARCHITECTURAL CONSTRAINT: NO DELETE METHOD IS IMPLEMENTED.
 * Realtor records are permanent business history in Supabase.
 * De-listing is performed strictly via is_active = false.
 */
export async function PATCH(
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
    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Realtor ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = String(body.name).trim().slice(0, 150);
    if (body.phone !== undefined) updates.phone = String(body.phone).trim().slice(0, 50);
    if (body.telegram !== undefined) updates.telegram = body.telegram ? String(body.telegram).trim().slice(0, 100) : null;
    
    // Photo update (support both photo_url and avatar_url)
    if (body.photo_url !== undefined || body.avatar_url !== undefined) {
      const p = body.photo_url !== undefined ? body.photo_url : body.avatar_url;
      const photoVal = p ? String(p).trim() : null;
      updates.avatar_url = photoVal;
      updates.photo_url = photoVal;
    }

    // Instagram URL update with strict HTTPS validation
    let validatedInstagram: string | null = undefined as any;
    if (body.instagram_url !== undefined || body.instagram !== undefined) {
      const rawInsta = body.instagram_url !== undefined ? body.instagram_url : body.instagram;
      try {
        validatedInstagram = sanitizeInstagramUrl(rawInsta);
        updates.instagram_url = validatedInstagram;
        saveRealtorMeta(id, { instagram_url: validatedInstagram });
      } catch (valErr: any) {
        return NextResponse.json({ success: false, error: valErr.message }, { status: 400 });
      }
    }

    if (body.experience_years !== undefined) updates.experience_years = Math.max(Number(body.experience_years) || 0, 0);
    if (body.position_uz !== undefined) updates.position_uz = String(body.position_uz).trim().slice(0, 100);
    if (body.position_ru !== undefined) updates.position_ru = String(body.position_ru).trim().slice(0, 100);
    if (body.specialization_uz !== undefined) updates.specialization_uz = String(body.specialization_uz).trim().slice(0, 200);
    if (body.specialization_ru !== undefined) updates.specialization_ru = String(body.specialization_ru).trim().slice(0, 200);
    if (body.location !== undefined) {
      const locStr = String(body.location).trim();
      updates.districts = locStr ? locStr.split(",").map((s: any) => String(s).trim()).filter(Boolean) : [];
    }
    if (body.districts !== undefined && body.location === undefined) {
      updates.districts = Array.isArray(body.districts)
        ? body.districts.map((d: any) => String(d).trim()).filter(Boolean)
        : [];
    }
    if (body.bio_uz !== undefined) updates.bio_uz = body.bio_uz ? String(body.bio_uz).trim() : null;
    if (body.bio_ru !== undefined) updates.bio_ru = body.bio_ru ? String(body.bio_ru).trim() : null;
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    let { data: updatedRealtor, error } = await supabaseAdmin
      .from("realtors")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error && (error.message.includes("photo_url") || error.message.includes("instagram_url"))) {
      // Fallback if photo_url or instagram_url column is not yet in remote table schema
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.photo_url;
      delete fallbackUpdates.instagram_url;
      const retry = await supabaseAdmin
        .from("realtors")
        .update(fallbackUpdates)
        .eq("id", id)
        .select("*")
        .single();
      updatedRealtor = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[Admin Realtor PATCH] Update error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const extra = getRealtorsMeta()[id] || {};
    const resPhoto = updates.photo_url !== undefined ? updates.photo_url : (updatedRealtor?.avatar_url || updatedRealtor?.photo_url || extra.photo_url || null);
    const resInsta = updates.instagram_url !== undefined ? updates.instagram_url : (updatedRealtor?.instagram_url || updatedRealtor?.instagram || extra.instagram_url || null);
    const locText = (updatedRealtor?.districts && Array.isArray(updatedRealtor.districts) && updatedRealtor.districts.length > 0)
      ? updatedRealtor.districts.join(", ")
      : (body.location !== undefined ? (body.location || null) : null);

    return NextResponse.json({
      success: true,
      realtor: {
        ...updatedRealtor,
        location: locText,
        location_uz: locText,
        location_ru: locText,
        photo_url: resPhoto,
        avatar_url: resPhoto,
        instagram_url: resInsta,
        instagram: resInsta,
      },
      message: updates.is_active !== undefined 
        ? (updates.is_active ? "Realtor activated successfully" : "Realtor deactivated successfully")
        : "Realtor updated successfully",
    });
  } catch (error: any) {
    console.error("[Admin Realtor PATCH] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * STRICTLY DISALLOWED: Realtor records are preserved business history and cannot be deleted.
 * Administrators must use `is_active: false` (deactivation) instead.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: "Method Not Allowed: Realtor records are preserved business history and cannot be deleted. Use deactivation (is_active: false) instead.",
    },
    {
      status: 405,
      headers: { Allow: "GET, PATCH" },
    }
  );
}
