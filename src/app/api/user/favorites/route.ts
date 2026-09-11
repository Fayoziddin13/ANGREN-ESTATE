import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function getSSRClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {}
        },
      },
    }
  );
}

async function getActiveUser() {
  const supabase = getSSRClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: "Unauthorized", status: 401 };
  }

  // Check active status in public.profiles
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "disabled") {
    return { user: null, error: "Account is disabled", status: 403 };
  }

  return { user, error: null, status: 200 };
}

// GET /api/user/favorites - Return list of favorited property IDs
export async function GET() {
  try {
    const { user, error, status } = await getActiveUser();
    if (!user) {
      return NextResponse.json({ error }, { status });
    }

    const { data: favorites, error: favError } = await supabaseAdmin
      .from("favorites")
      .select("property_id")
      .eq("user_id", user.id);

    if (favError) {
      return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
    }

    const propertyIds = (favorites || []).map((f) => f.property_id);
    return NextResponse.json({ success: true, favorites: propertyIds });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/user/favorites - Add a property to favorites
export async function POST(request: NextRequest) {
  try {
    const { user, error, status } = await getActiveUser();
    if (!user) {
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = body?.property_id;
    if (!propertyId || typeof propertyId !== "string") {
      return NextResponse.json({ error: "Missing or invalid property_id" }, { status: 400 });
    }

    // Insert favorite (idempotent)
    const { error: insertError } = await supabaseAdmin
      .from("favorites")
      .upsert(
        { user_id: user.id, property_id: propertyId },
        { onConflict: "user_id,property_id" }
      );

    if (insertError) {
      console.error("[User Favorites API] Insert error:", insertError);
      return NextResponse.json({ error: "Failed to save favorite" }, { status: 500 });
    }

    return NextResponse.json({ success: true, property_id: propertyId, added: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/user/favorites - Remove a property from favorites
export async function DELETE(request: NextRequest) {
  try {
    const { user, error, status } = await getActiveUser();
    if (!user) {
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = body?.property_id;
    if (!propertyId || typeof propertyId !== "string") {
      return NextResponse.json({ error: "Missing or invalid property_id" }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);

    if (deleteError) {
      console.error("[User Favorites API] Delete error:", deleteError);
      return NextResponse.json({ error: "Failed to remove favorite" }, { status: 500 });
    }

    return NextResponse.json({ success: true, property_id: propertyId, removed: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
