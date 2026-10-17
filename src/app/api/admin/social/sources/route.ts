import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getNewsSources, saveNewsSource } from "@/lib/newsStore";

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

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sources = await getNewsSources();
    return NextResponse.json({ success: true, sources });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, domain, feed_url, source_type = "rss", trust_level = "reputable_media", check_frequency_min = 240, is_active = true } = body;

    if (!name || !domain || !feed_url) {
      return NextResponse.json(
        { success: false, error: "name, domain va feed_url maydonlari majburiy" },
        { status: 400 }
      );
    }

    const saved = await saveNewsSource({
      id,
      name,
      domain,
      feed_url,
      source_type,
      trust_level,
      check_frequency_min,
      is_active,
    });

    return NextResponse.json({ success: true, source: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
