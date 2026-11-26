import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { devToolsAllowed } from "@/lib/env/safety";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * LOCAL TEST LOGIN. Signs in one of two fixed test users of the TEST Supabase
 * project and returns their session; the browser stores it like a Google login.
 * Refused (404) on Vercel, in production builds and for any non-test database.
 * The password is random on every call and never leaves the server.
 */
export async function POST(req: NextRequest) {
  if (!devToolsAllowed().allowed) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const n = body?.user === 2 ? 2 : 1;
  const email = `test${n}@angren-estate.test`;
  const password = crypto.randomBytes(24).toString("base64url");

  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    return NextResponse.json({ success: false, error: "service_key_missing", message: listError.message }, { status: 500 });
  }
  const existing = list.users.find((u) => u.email === email);
  const result = existing
    ? await supabaseAdmin.auth.admin.updateUserById(existing.id, { password })
    : await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Test foydalanuvchi ${n}` },
      });
  if (result.error) {
    return NextResponse.json({ success: false, error: "test_user_failed", message: result.error.message }, { status: 500 });
  }

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ success: false, error: "sign_in_failed", message: error?.message }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    email,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
