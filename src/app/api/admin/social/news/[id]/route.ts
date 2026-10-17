import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import {
  getNewsById,
  saveNewsItem,
  saveNewsTranslation,
  updateNewsStatus,
} from "@/lib/newsStore";

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

export async function GET(
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

    return NextResponse.json({ success: true, news });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
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

    const news = await getNewsById(params.id);
    if (!news) {
      return NextResponse.json({ success: false, error: "News not found" }, { status: 404 });
    }

    const body = await request.json();

    if (body.status) {
      await updateNewsStatus(params.id, body.status);
    }

    if (body.category || body.verified_stat_value !== undefined) {
      await saveNewsItem({
        ...news,
        category: body.category || news.category,
        verified_stat_value: body.verified_stat_value !== undefined ? body.verified_stat_value : news.verified_stat_value,
      });
    }

    if (body.uz_title || body.uz_summary || body.uz_takeaway) {
      await saveNewsTranslation({
        news_id: params.id,
        language: "uz",
        title: body.uz_title || news.translations?.uz?.title || news.original_title,
        summary: body.uz_summary || news.translations?.uz?.summary || "",
        practical_takeaway: body.uz_takeaway || news.translations?.uz?.practical_takeaway,
        is_reviewed_by_admin: true,
      });
    }

    if (body.ru_title || body.ru_summary || body.ru_takeaway) {
      await saveNewsTranslation({
        news_id: params.id,
        language: "ru",
        title: body.ru_title || news.translations?.ru?.title || news.original_title,
        summary: body.ru_summary || news.translations?.ru?.summary || "",
        practical_takeaway: body.ru_takeaway || news.translations?.ru?.practical_takeaway,
        is_reviewed_by_admin: true,
      });
    }

    const updated = await getNewsById(params.id);
    return NextResponse.json({ success: true, news: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await updateNewsStatus(params.id, "rejected");
    return NextResponse.json({ success: true, message: "News marked as rejected" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
