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

// Extract the relative storage path inside 'property-images' from URL or path
function extractStoragePath(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  const bucketMarker = "/property-images/";
  const markerIdx = trimmed.indexOf(bucketMarker);
  if (markerIdx !== -1) {
    return decodeURIComponent(trimmed.slice(markerIdx + bucketMarker.length).split("?")[0]);
  }
  if (trimmed.startsWith("properties/")) {
    return trimmed;
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

    const body = await request.json();
    const { url, path: inputPath } = body || {};

    const storagePath = extractStoragePath(inputPath || url);
    if (!storagePath) {
      // If it's an external URL (e.g. unsplash), nothing to delete in Supabase storage
      return NextResponse.json({
        success: true,
        message: "External image reference; no Supabase storage deletion required.",
      });
    }

    // Check if another property in public.properties references this exact storage path or URL
    const searchTarget = url || storagePath;
    const { data: propertiesWithImage, error: searchError } = await supabaseAdmin
      .from("properties")
      .select("id, photos")
      .or(`photos.cs.{"${searchTarget}"},images.cs.{"${searchTarget}"}`);

    if (!searchError && propertiesWithImage && propertiesWithImage.length > 1) {
      // Referenced by other properties, do not delete the physical object
      return NextResponse.json({
        success: true,
        removedFromStorage: false,
        message: "Image is referenced by another property; storage object retained.",
      });
    }

    // Safe to delete from Supabase storage
    const { data: delData, error: delError } = await supabaseAdmin.storage
      .from("property-images")
      .remove([storagePath]);

    if (delError) {
      console.error(`[Storage] Failed to delete ${storagePath}:`, delError);
      return NextResponse.json(
        { success: false, error: `Rasmni o'chirishda xatolik: ${delError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      removedFromStorage: true,
      deletedPath: storagePath,
    });
  } catch (error: any) {
    console.error("Error in /api/admin/properties/delete-image:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Server xatosi" },
      { status: 500 }
    );
  }
}
