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

const SECTION_TO_KEY: Record<string, string> = {
  hero: "cms_hero",
  about: "cms_about",
  contacts: "cms_contacts",
  announcement: "cms_announcement",
  seo: "cms_seo",
  settings: "site_settings",
};

// Recursive string sanitizer to strip script tags and dangerous HTML/javascript injection
function sanitizeData(input: any): any {
  if (typeof input === "string") {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/onload=/gi, "")
      .replace(/onerror=/gi, "");
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeData);
  }
  if (typeof input === "object" && input !== null) {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      cleaned[k] = sanitizeData(v);
    }
    return cleaned;
  }
  return input;
}

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED", message: "Administrator ruxsati talab etiladi" },
      { status: 401 }
    );
  }

  try {
    const keys = Object.values(SECTION_TO_KEY);
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", keys);

    if (error) {
      return NextResponse.json(
        { success: false, error: "DATABASE_ERROR", message: error.message },
        { status: 500 }
      );
    }

    const content: Record<string, any> = {};
    const timestamps: Record<string, string> = {};
    const sections: Record<string, { data: any; updated_at: string }> = {};

    for (const [section, dbKey] of Object.entries(SECTION_TO_KEY)) {
      const found = data?.find((r) => r.key === dbKey);
      content[section] = found?.value || {};
      timestamps[section] = found?.updated_at || "";
      sections[section] = {
        data: found?.value || {},
        updated_at: found?.updated_at || "",
      };
    }

    return NextResponse.json({
      success: true,
      content,
      timestamps,
      sections,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
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

  const { section, data: incomingData, expected_updated_at } = body || {};

  if (!section || !SECTION_TO_KEY[section]) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_SECTION",
        message: `Noto‘g‘ri bo‘lim. Ruxsat etilgan bo‘limlar: ${Object.keys(SECTION_TO_KEY).join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (!incomingData || typeof incomingData !== "object") {
    return NextResponse.json(
      { success: false, error: "INVALID_DATA", message: "Tahrirlash ma’lumotlari kiritilishi shart" },
      { status: 400 }
    );
  }

  const dbKey = SECTION_TO_KEY[section];

  try {
    // 1. Fetch current row to check optimistic concurrency
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("app_settings")
      .select("key, value, updated_at")
      .eq("key", dbKey)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { success: false, error: "DATABASE_ERROR", message: fetchErr.message },
        { status: 500 }
      );
    }

    // 2. Sanitize incoming data
    const cleanedData = sanitizeData(incomingData);
    const mergedValue = current?.value ? { ...current.value, ...cleanedData } : cleanedData;
    const now = new Date().toISOString();

    // 3. Atomic Compare-And-Swap (CAS) if expected_updated_at is provided
    if (current && expected_updated_at) {
      const { data: updatedRows, error: updateErr } = await supabaseAdmin
        .from("app_settings")
        .update({
          value: mergedValue,
          updated_at: now,
        })
        .eq("key", dbKey)
        .eq("updated_at", expected_updated_at)
        .select("key, value, updated_at");

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: "DATABASE_ERROR", message: updateErr.message },
          { status: 500 }
        );
      }

      // If 0 rows were updated, a concurrent transaction updated the record first!
      if (!updatedRows || updatedRows.length === 0) {
        const { data: latest } = await supabaseAdmin
          .from("app_settings")
          .select("updated_at")
          .eq("key", dbKey)
          .maybeSingle();

        return NextResponse.json(
          {
            success: false,
            error: "VERSION_CONFLICT",
            message: "Ushbu bo‘lim boshqa administrator tomonidan yangilangan. Iltimos, sahifani yangilang va qayta urinib ko‘ring.",
            current_updated_at: latest?.updated_at || null,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        updated_section: section,
        data: mergedValue,
        updated_at: updatedRows[0].updated_at,
      });
    }

    // 4. Fallback atomic upsert if record doesn't exist yet or no expected timestamp was provided
    const { data: upsertedRows, error: upsertErr } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: dbKey,
        value: mergedValue,
        updated_at: now,
      })
      .select("key, value, updated_at");

    if (upsertErr) {
      return NextResponse.json(
        { success: false, error: "UPSERT_FAILED", message: upsertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated_section: section,
      data: mergedValue,
      updated_at: upsertedRows?.[0]?.updated_at || now,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

// Strictly disallow DELETE method (HTTP 405 Method Not Allowed)
export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message: "CMS yozuvlarini o‘chirish taqiqlangan. Faqat yangilash ruxsat etiladi.",
    },
    {
      status: 405,
      headers: { Allow: "GET, PATCH" },
    }
  );
}
