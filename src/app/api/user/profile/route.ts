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

export async function GET() {
  try {
    const supabase = getSSRClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, avatar_url, role, status, phone, last_activity, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSSRClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Explicitly prohibit client updates to protected fields
    if (body.role !== undefined || body.status !== undefined || body.id !== undefined || body.email !== undefined) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot modify protected profile fields (role, status, id, email)" },
        { status: 403 }
      );
    }

    const allowedUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.full_name === "string") allowedUpdates.full_name = body.full_name.trim();
    if (typeof body.avatar_url === "string") allowedUpdates.avatar_url = body.avatar_url.trim();
    if (typeof body.phone === "string") allowedUpdates.phone = body.phone.trim();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(allowedUpdates)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
