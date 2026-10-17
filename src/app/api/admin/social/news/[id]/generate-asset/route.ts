import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getNewsById } from "@/lib/newsStore";
import { generateAndSaveNewsAsset } from "@/lib/newsVisualGenerator";

export const dynamic = "force-dynamic";

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const news = await getNewsById(params.id);
    if (!news) {
      return NextResponse.json({ success: false, error: "News not found" }, { status: 404 });
    }

    let lang: "uz" | "ru" | "both" = "both";
    try {
      const body = await request.json();
      if (body.lang) lang = body.lang;
    } catch {}

    const results: any = {};

    if (lang === "uz" || lang === "both") {
      results.uz = await generateAndSaveNewsAsset(news, "uz");
    }
    if (lang === "ru" || lang === "both") {
      results.ru = await generateAndSaveNewsAsset(news, "ru");
    }

    return NextResponse.json({ success: true, assets: results });
  } catch (err: any) {
    console.error("[Generate Asset API] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Asset generation error" }, { status: 500 });
  }
}
