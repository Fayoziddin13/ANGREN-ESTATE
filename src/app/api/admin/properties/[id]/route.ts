import { NextRequest, NextResponse } from "next/server";
import { getPropertyById, updateProperty, deleteProperty } from "@/lib/properties";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function getPropertyImagePaths(urls: unknown[]): string[] {
  const paths = new Set<string>();

  for (const url of urls) {
    if (typeof url !== "string") continue;
    const marker = "/property-images/";
    const index = url.indexOf(marker);
    if (index === -1) continue;

    const path = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
    if (path) paths.add(path);
  }

  return [...paths];
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    const property = await getPropertyById(id, { useAdmin: true });

    if (!property) {
      return NextResponse.json({ success: false, error: "Property not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, property });
  } catch (error) {
    console.error("Error in /api/admin/properties/[id] GET:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    const updates = await request.json();

    const updated = await updateProperty(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Property not found or failed to update" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      property: updated,
    });
  } catch (error) {
    console.error("Error in /api/admin/properties/[id] PATCH:", error);
    return NextResponse.json({ success: false, error: "Failed to update property" }, { status: 500 });
  }
}

/**
 * Admin-only permanent delete for a property.
 * Deletes photos from Supabase Storage, then hard-deletes the DB record.
 * Requires active admin session (angren_admin_token).
 */
export async function DELETE(
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

    const id = params.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Property ID is required" },
        { status: 400 }
      );
    }

    // 1. Fetch property to get photos before deletion
    const { data: propertyRow, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, photos, images, main_image")
      .eq("id", id)
      .single();

    if (fetchError || !propertyRow) {
      return NextResponse.json(
        { success: false, error: "Property not found" },
        { status: 404 }
      );
    }

    // 2. Identify media owned only by this property. A media file can be
    // reused by another record, so never remove it without checking first.
    const allUrls: string[] = [
      ...(Array.isArray(propertyRow.photos) ? propertyRow.photos : []),
      ...(Array.isArray(propertyRow.images) ? propertyRow.images : []),
      ...(propertyRow.main_image ? [propertyRow.main_image] : []),
    ];

    const { data: otherProperties, error: ownershipError } = await supabaseAdmin
      .from("properties")
      .select("id, photos, images, main_image")
      .neq("id", id);

    if (ownershipError) {
      console.error(`[Admin DELETE Property] Media ownership check failed for ${id}:`, ownershipError.message);
      return NextResponse.json(
        { success: false, error: "Could not verify property media ownership. Nothing was deleted." },
        { status: 500 }
      );
    }

    const sharedPaths = new Set(
      (otherProperties || []).flatMap((property) =>
        getPropertyImagePaths([
          ...(Array.isArray(property.photos) ? property.photos : []),
          ...(Array.isArray(property.images) ? property.images : []),
          ...(property.main_image ? [property.main_image] : []),
        ])
      )
    );
    const storagePaths = getPropertyImagePaths(allUrls).filter((path) => !sharedPaths.has(path));

    // 3. Delete the database record first. If this fails, all media remains intact.
    const { error: deleteError } = await supabaseAdmin
      .from("properties")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(`[Admin DELETE Property] DB delete error for ${id}:`, deleteError.message);
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      );
    }

    // 4. Clean up only media no longer referenced by another property.
    // The record is already deleted, so a storage failure is reported explicitly
    // rather than claiming that every part of the cleanup succeeded.
    let storageWarning: string | null = null;
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("property-images")
        .remove(storagePaths);
      if (storageError) {
        storageWarning = storageError.message;
        console.error(`[Admin DELETE Property] Storage cleanup error for ${id}:`, storageError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: storageWarning
        ? `Property '${id}' was deleted, but ${storagePaths.length} storage file(s) need manual cleanup.`
        : `Property '${id}' permanently deleted. ${storagePaths.length} unshared photo(s) removed from storage.`,
      deletedPhotos: storagePaths.length,
      retainedSharedPhotos: getPropertyImagePaths(allUrls).length - storagePaths.length,
      storageWarning,
    });
  } catch (error: any) {
    console.error("[Admin DELETE Property] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
