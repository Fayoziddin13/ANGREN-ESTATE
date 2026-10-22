import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getNewsById, saveNewsAsset } from "@/lib/newsStore";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabaseServer";
import { isValidImageBuffer, newsImageBufferCache } from "@/lib/newsVisualGenerator";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session) return session;

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session) {
      return verified.session;
    }
  }

  return null;
}

/**
 * Upload custom image from admin's computer for a specific news article.
 * Validates binary signature (JPEG/PNG/WEBP), enforces 10MB limit, uploads to Supabase Storage,
 * and updates news asset registry.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Ruxsat berilmagan (Unauthorized)" }, { status: 401 });
    }

    const news = await getNewsById(params.id);
    if (!news) {
      return NextResponse.json({ success: false, error: "Yangilik topilmadi (News not found)" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const lang = (formData.get("lang") as string) === "ru" ? "ru" : "uz";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Hech qanday fayl tanlanmadi (No file uploaded)" },
        { status: 400 }
      );
    }

    // 10MB file size limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "Fayl hajmi 10 MB dan oshmasligi kerak (File exceeds 10MB)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate binary buffer signature (JPEG, PNG, WEBP)
    if (!isValidImageBuffer(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error: "Faqat haqiqiy JPEG, PNG yoki WEBP formatidagi rasmlar qabul qilinadi (SVG/HTML taqiqlangan)",
        },
        { status: 400 }
      );
    }

    // Determine extension & contentType
    let ext = "jpg";
    let contentType = "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      ext = "png";
      contentType = "image/png";
    } else if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      ext = "webp";
      contentType = "image/webp";
    }

    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const filename = `custom_${news.id}_${lang}_${randomSuffix}.${ext}`;
    const storagePath = `news/${news.id}/${filename}`;

    let publicUrl = "";

    if (isSupabaseConfigured) {
      try {
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("property-images")
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadErr) {
          console.error("[Upload Asset API] Supabase storage upload error:", uploadErr.message);
        } else {
          const { data: pubData } = supabaseAdmin.storage
            .from("property-images")
            .getPublicUrl(storagePath);
          publicUrl = pubData.publicUrl;
        }
      } catch (uploadException: any) {
        console.error("[Upload Asset API] Upload exception:", uploadException.message);
      }
    }

    // Cache the buffer in memory for instant Telegram multipart upload
    const cacheKey = `${news.id}_${lang}`;
    newsImageBufferCache.set(cacheKey, { buffer, timestamp: Date.now() });

    // Fallback URL if Supabase was unconfigured
    if (!publicUrl) {
      publicUrl = `https://angrenestate.uz/uploads/${storagePath}`;
    }

    const asset = await saveNewsAsset({
      news_id: news.id,
      language: lang,
      storage_path: storagePath,
      public_url: publicUrl,
      asset_type: "custom_upload",
      source_origin: "custom_upload",
      width: 1200,
      height: 675,
    });

    const updatedNews = await getNewsById(params.id);

    return NextResponse.json({
      success: true,
      asset,
      news: updatedNews,
      message: "Rasm muvaffaqiyatli yuklandi va yangilikka biriktirildi",
    });
  } catch (err: any) {
    console.error("[Upload Asset API] Unhandled error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Faylni yuklashda server xatoligi" },
      { status: 500 }
    );
  }
}
