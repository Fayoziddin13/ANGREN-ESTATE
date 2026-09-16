import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { translateContent, TranslationResult } from "@/lib/translationService";

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
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Ruxsat berilmagan (Unauthorized)" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Batch translation support
    if (Array.isArray(body.items)) {
      const results: Array<{ key?: string; result: TranslationResult }> = [];
      for (const item of body.items) {
        if (!item || typeof item.text !== "string") continue;
        const from = item.from === "ru" ? "ru" : "uz";
        const to = item.to === "ru" ? "ru" : "uz";
        const res = await translateContent(item.text, from, to);
        results.push({
          key: item.key,
          result: res,
        });
      }
      return NextResponse.json({ success: true, results });
    }

    // Single translation support
    const text = typeof body.text === "string" ? body.text : "";
    const from = body.from === "ru" ? "ru" : "uz";
    const to = body.to === "ru" ? "ru" : "uz";

    const result = await translateContent(text, from, to);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Noma'lum xatolik";
    return NextResponse.json(
      {
        success: false,
        error: message,
        status: "failed",
      },
      { status: 500 }
    );
  }
}
