import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for realtor photos

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session && session.role === "admin") return session;

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session && verified.session.role === "admin") {
      return verified.session;
    }
  }

  return null;
}

function getExtension(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
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

    const formData = await request.formData();
    const realtorId = (formData.get("realtorId") as string) || "general";

    let file: File | null = null;
    const singleFile = formData.get("file") as File | null;
    const photoFile = formData.get("photo") as File | null;
    if (singleFile instanceof File && singleFile.size > 0) {
      file = singleFile;
    } else if (photoFile instanceof File && photoFile.size > 0) {
      file = photoFile;
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Rasm fayli tanlanmadi (No image file provided)" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Faqat JPG, JPEG, PNG yoki WEBP formatidagi rasmlar ruxsat etiladi",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Rasm hajmi 5 MB dan oshmasligi lozim (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
        },
        { status: 400 }
      );
    }

    const ext = getExtension(file.name, file.type);
    const safeId = realtorId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const randomSuffix = crypto.randomBytes(6).toString("hex");
    const timestamp = Date.now();
    const storagePath = `realtors/${safeId}/${timestamp}_${randomSuffix}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabaseAdmin.storage
      .from("property-images")
      .upload(storagePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error(`[Storage] Upload error for realtor ${realtorId}:`, error);
      return NextResponse.json(
        {
          success: false,
          error: `Rasmni saqlashda xatolik: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("property-images")
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: storagePath,
      name: file.name,
      size: file.size,
    });
  } catch (error: any) {
    console.error("Error in /api/admin/realtors/upload:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server xatosi" },
      { status: 500 }
    );
  }
}
