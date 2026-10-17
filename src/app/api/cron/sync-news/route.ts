import { NextRequest, NextResponse } from "next/server";
import { harvestAllActiveSources } from "@/lib/newsHarvester";

export const dynamic = "force-dynamic";

/**
 * Scheduled Cron Job for Automatic Real Estate News Synchronization.
 * Protected by Vercel CRON_SECRET or ADMIN_JWT_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_JWT_SECRET;

    // In production, verify bearer secret
    if (process.env.NODE_ENV === "production" && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: "Unauthorized cron request" }, { status: 401 });
      }
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
