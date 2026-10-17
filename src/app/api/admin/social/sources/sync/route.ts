import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { harvestAllActiveSources, harvestFromSingleSource } from "@/lib/newsHarvester";
import { getNewsSources } from "@/lib/newsStore";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  // 1. Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session) {
      return verified.session;
    }
  }

  // 2. NextRequest cookies
  try {
    const cookieToken = request.cookies?.get("angren_admin_session")?.value;
    if (cookieToken) {
      const verified = verifyAdminSessionToken(cookieToken);
      if (verified.valid && verified.session) {
        return verified.session;
      }
    }
  } catch {}

  // 3. Fallback to getAdminSessionServer
  const session = await getAdminSessionServer();
  if (session) return session;

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
      const updatedSources = await getNewsSources();
      const updatedSource = updatedSources.find((s) => s.id === sourceId) || targetSource;
      return NextResponse.json({ success: true, result, source: updatedSource });
    }

    // Harvest all active sources
    const results = await harvestAllActiveSources();
    const totalFound = results.reduce((acc, r) => acc + r.itemsFound, 0);
    const totalRelevant = results.reduce((acc, r) => acc + (r.relevantFound || 0), 0);
    const totalDuplicates = results.reduce((acc, r) => acc + (r.duplicatesCount || 0), 0);
    const totalNew = results.reduce((acc, r) => acc + r.newItemsSaved, 0);
    const sourcesSuccessful = results.filter((r) => !r.error).length;
    const sourcesFailed = results.filter((r) => Boolean(r.error)).length;
    const updatedSources = await getNewsSources();

    return NextResponse.json({
      success: true,
      summary: {
        sourcesChecked: results.length,
        sourcesSuccessful,
        sourcesFailed,
        totalFound,
        totalRelevant,
        totalDuplicates,
        totalNew,
      },
      results,
      sources: updatedSources,
    });
  } catch (err: any) {
    console.error("[News Sync API] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Sync error" }, { status: 500 });
  }
}
