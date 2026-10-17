import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import {
  getNewsList,
  saveNewsItem,
  saveNewsTranslation,
  computeUrlHash,
} from "@/lib/newsStore";
import type { NewsCategory, NewsStatus } from "@/lib/types/news";

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

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as NewsStatus) || undefined;
    const category = (searchParams.get("category") as NewsCategory) || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { items, total } = await getNewsList({
      status,
      category,
      search,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, items, total });
  } catch (err: any) {
    console.error("[News API GET] Error:", err);
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
    const {
      original_title,
      original_url,
      category = "market_prices",
      verified_stat_value,
      uz_title,
      uz_summary,
      uz_takeaway,
      ru_title,
      ru_summary,
      ru_takeaway,
    } = body;

    if (!original_title || !original_url) {
      return NextResponse.json(
        { success: false, error: "original_title va original_url maydonlari majburiy" },
        { status: 400 }
      );
    }

    const urlHash = computeUrlHash(original_url);

    const savedNews = await saveNewsItem({
      original_title,
      original_url,
      url_hash: urlHash,
      category,
      published_at: new Date().toISOString(),
      discovered_at: new Date().toISOString(),
      status: "ready",
      requires_fact_check: false,
      verified_stat_value,
    });

    if (uz_title || uz_summary) {
      await saveNewsTranslation({
        news_id: savedNews.id,
        language: "uz",
        title: uz_title || original_title,
        summary: uz_summary || original_title,
        practical_takeaway: uz_takeaway,
        is_reviewed_by_admin: true,
      });
    }

    if (ru_title || ru_summary) {
      await saveNewsTranslation({
        news_id: savedNews.id,
        language: "ru",
        title: ru_title || original_title,
        summary: ru_summary || original_title,
        practical_takeaway: ru_takeaway,
        is_reviewed_by_admin: true,
      });
    }

    return NextResponse.json({ success: true, news: savedNews });
  } catch (err: any) {
    console.error("[News API POST] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
