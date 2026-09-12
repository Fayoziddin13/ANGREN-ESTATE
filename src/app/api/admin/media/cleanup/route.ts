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

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;
    const action = body.action || "scan";

    // 1. List files in storage bucket 'property-images'
    const { data: storageList, error: storageError } = await supabaseAdmin.storage
      .from("property-images")
      .list("properties", { limit: 1000 });

    const storageFiles = Array.isArray(storageList)
      ? storageList.map((f) => "properties/" + f.name)
      : [];

    // 2. Fetch all properties (including draft & archived) to collect referenced images
    const { data: properties, error: dbError } = await supabaseAdmin
      .from("properties")
      .select("id, photos, images, main_image");

    const referencedPaths = new Set<string>();

    if (Array.isArray(properties)) {
      properties.forEach((p) => {
        const allPhotos: string[] = [
          ...(Array.isArray(p.photos) ? p.photos : []),
          ...(Array.isArray(p.images) ? p.images : []),
          ...(p.main_image ? [p.main_image] : []),
        ];

        allPhotos.forEach((urlOrPath) => {
          if (typeof urlOrPath !== "string") return;
          const bucketMarker = "/property-images/";
          const markerIdx = urlOrPath.indexOf(bucketMarker);
          if (markerIdx !== -1) {
            referencedPaths.add(decodeURIComponent(urlOrPath.slice(markerIdx + bucketMarker.length).split("?")[0]));
          } else if (urlOrPath.startsWith("properties/")) {
            referencedPaths.add(urlOrPath);
          }
        });
      });
    }

    // 3. Detect orphaned files
    const orphanedFiles = storageFiles.filter((filePath) => !referencedPaths.has(filePath));

    let purgedCount = 0;
    if (action === "purge" && !dryRun && orphanedFiles.length > 0) {
      const { data: removeData, error: removeError } = await supabaseAdmin.storage
        .from("property-images")
        .remove(orphanedFiles);

      if (!removeError && removeData) {
        purgedCount = removeData.length;
      }
    }

    return NextResponse.json({
      success: true,
      action,
      dryRun,
      totalStorageFiles: storageFiles.length,
      referencedFilesCount: referencedPaths.size,
      orphanedFilesCount: orphanedFiles.length,
      orphanedFiles: orphanedFiles.slice(0, 100),
      purgedCount,
      message:
        orphanedFiles.length === 0
          ? "Barcha rasmlar bazadagi e'lonlar bilan to'liq bog'langan. Ortiqcha fayllar topilmadi."
          : dryRun
          ? orphanedFiles.length + " ta yetim rasm aniqlandi. Haqiqiy tozalash uchun action: 'purge', dryRun: false yuboring."
          : purgedCount + " ta yetim rasm xavfsiz o'chirildi.",
    });
  } catch (error: any) {
    console.error("Error in /api/admin/media/cleanup:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server xatosi" },
      { status: 500 }
    );
  }
}
