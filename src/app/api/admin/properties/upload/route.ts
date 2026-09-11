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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

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
    const propertyId = (formData.get("propertyId") as string) || "general";

    let files: File[] = [];
    const filesList = formData.getAll("files") as File[];
    const singleFileList = formData.getAll("file") as File[];
    if (filesList.length > 0) {
      files = filesList.filter((f) => f instanceof File && f.size > 0);
    } else if (singleFileList.length > 0) {
      files = singleFileList.filter((f) => f instanceof File && f.size > 0);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Yuklash uchun hech qanday rasm fayli tanlanmadi." },
        { status: 400 }
      );
    }

    const uploadedImages: Array<{
      path: string;
      url: string;
      name: string;
      size: number;
    }> = [];

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Faqat JPG, JPEG, PNG yoki WEBP formatidagi rasmlar ruxsat etiladi (${file.name}).`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `Rasm hajmi 10 MB dan oshmasligi lozim (${file.name}: ${(
              file.size /
              (1024 * 1024)
            ).toFixed(1)} MB).`,
          },
          { status: 400 }
        );
      }

      const ext = getExtension(file.name, file.type);
      const safeId = propertyId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const randomSuffix = crypto.randomBytes(6).toString("hex");
      const timestamp = Date.now();
      const storagePath = `properties/${safeId}/${timestamp}_${randomSuffix}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { data, error } = await supabaseAdmin.storage
        .from("property-images")
        .upload(storagePath, buffer, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error(`[Storage] Upload error for ${file.name}:`, error);
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

      uploadedImages.push({
        path: storagePath,
        url: urlData.publicUrl,
        name: file.name,
        size: file.size,
      });
    }

    return NextResponse.json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
    });
  } catch (error: any) {
    console.error("Error in /api/admin/properties/upload:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server xatosi" },
      { status: 500 }
    );
  }
}
