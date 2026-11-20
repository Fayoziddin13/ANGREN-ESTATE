import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { harvestAllActiveSources } from "@/lib/newsHarvester";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Scheduled Cron Job for Automatic Real Estate News Synchronization.
 * Protected by Vercel CRON_SECRET or ADMIN_JWT_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. The admin session
    // signing key is deliberately NOT reused here (one secret per purpose).
    const cronSecret = process.env.CRON_SECRET;
    const isAuthorized = Boolean(cronSecret) && safeEqual(authHeader || "", `Bearer ${cronSecret}`);

    // In production, ensure cron secret is configured (503 if missing) and check Authorization (401 if invalid)
    if (process.env.NODE_ENV === "production") {
      if (!cronSecret) {
        return NextResponse.json(
          { success: false, error: "CRON_SECRET is not configured on the server" },
          { status: 503 }
        );
      }
      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Unauthorized cron request" },
          { status: 401 }
        );
      }
    } else if (cronSecret && authHeader && !isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized cron request" },
        { status: 401 }
      );
    }

    const results = await harvestAllActiveSources();
    const totalFound = results.reduce((acc, r) => acc + r.itemsFound, 0);
    const totalNew = results.reduce((acc, r) => acc + r.newItemsSaved, 0);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        sourcesChecked: results.length,
        totalFound,
        totalNew,
      },
      results,
    });
  } catch (err: any) {
    console.error("[Cron Sync News] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Cron execution error" }, { status: 500 });
  }
}
