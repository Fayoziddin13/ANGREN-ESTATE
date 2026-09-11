import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const isSafeNext = typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://");
  const safeNext = isSafeNext ? rawNext : "/";
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  if (error) {
    console.error("[Auth Callback] OAuth error:", error, error_description);
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error_description || error)}`
    );
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
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
            } catch (err) {
              // Server component cookie set guard
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.delete({ name, ...options });
            } catch (err) {
              // Server component cookie remove guard
            }
          },
        },
      }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[Auth Callback] exchangeCodeForSession error:", exchangeError.message);
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    if (data?.user) {
      try {
        const u = data.user;
        const fullName =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          (u.email ? u.email.split("@")[0] : "Foydalanuvchi");
        const avatarUrl = u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

        // Idempotent Profile Creation / Sync (Preserving existing role & status)
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, role, status")
          .eq("id", u.id)
          .maybeSingle();

        if (existingProfile) {
          // Update profile details without overwriting role or status
          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({
              full_name: fullName,
              avatar_url: avatarUrl,
              last_activity: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", u.id);

          if (updateError) {
            console.warn("[Auth Callback] Profile update warning:", updateError.message);
          }
        } else {
          // Insert new user profile with safe defaults
          const { error: insertError } = await supabaseAdmin
            .from("profiles")
            .insert({
              id: u.id,
              email: u.email || "",
              full_name: fullName,
              avatar_url: avatarUrl,
              role: "user",
              status: "active",
              last_activity: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.warn("[Auth Callback] Profile insert warning:", insertError.message);
          }
        }
      } catch (profileErr) {
        console.warn("[Auth Callback] Profile upsert exception:", profileErr);
      }
    }

    // Redirect to originating / requested page with strict open redirect guard
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
