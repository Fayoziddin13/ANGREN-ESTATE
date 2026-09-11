import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";

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

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED", message: "Administrator ruxsati talab etiladi" },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", "site_settings")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    settings: data?.value || {},
    updated_at: data?.updated_at || "",
  });
}

export async function PATCH(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED", message: "Administrator ruxsati talab etiladi" },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_JSON", message: "Noto‘g‘ri JSON formati" },
      { status: 400 }
    );
  }

  const { settings, expected_updated_at } = body || {};
  const incoming = settings || body;

  const { data: current } = await supabaseAdmin
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", "site_settings")
    .maybeSingle();

  const merged = current?.value ? { ...current.value, ...incoming } : incoming;
  const now = new Date().toISOString();

  // Atomic Compare-And-Swap (CAS) if expected_updated_at is provided
  if (current && expected_updated_at) {
    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("app_settings")
      .update({
        value: merged,
        updated_at: now,
      })
      .eq("key", "site_settings")
      .eq("updated_at", expected_updated_at)
      .select("key, value, updated_at");

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      const { data: latest } = await supabaseAdmin
        .from("app_settings")
        .select("updated_at")
        .eq("key", "site_settings")
        .maybeSingle();

      return NextResponse.json(
        {
          success: false,
          error: "VERSION_CONFLICT",
          message: "Sozlamalar boshqa administrator tomonidan yangilangan.",
          current_updated_at: latest?.updated_at || null,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: merged,
      updated_at: updatedRows[0].updated_at,
    });
  }

  // Fallback atomic upsert if record doesn't exist yet or no expected timestamp was provided
  const { data: upsertedRows, error: upsertErr } = await supabaseAdmin
    .from("app_settings")
    .upsert({
      key: "site_settings",
      value: merged,
      updated_at: now,
    })
    .select("key, value, updated_at");

  if (upsertErr) {
    return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    settings: merged,
    updated_at: upsertedRows?.[0]?.updated_at || now,
  });
}
