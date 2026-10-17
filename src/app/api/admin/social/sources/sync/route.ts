import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { harvestAllActiveSources, harvestFromSingleSource } from "@/lib/newsHarvester";
import { getNewsSources } from "@/lib/newsStore";

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

export async function POST(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let sourceId: string | undefined;
    try {
      const body = await request.json();
      sourceId = body?.sourceId;
    } catch {}

    if (sourceId) {
      const sources = await getNewsSources();
      const targetSource = sources.find((s) => s.id === sourceId);
      if (!targetSource) {
        return NextResponse.json({ success: false, error: "Source not found" }, { status: 404 });
      }

      const result = await harvestFromSingleSource(targetSource);
      return NextResponse.json({ success: true, result });
    }

    // Harvest all active sources
    const results = await harvestAllActiveSources();
    const totalFound = results.reduce((acc, r) => acc + r.itemsFound, 0);
    const totalNew = results.reduce((acc, r) => acc + r.newItemsSaved, 0);

    return NextResponse.json({
      success: true,
      summary: {
        sourcesChecked: results.length,
        totalFound,
        totalNew,
      },
      results,
    });
  } catch (err: any) {
    console.error("[News Sync API] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Sync error" }, { status: 500 });
  }
}
