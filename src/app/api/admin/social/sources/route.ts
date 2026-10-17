import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import {
  getNewsSources,
  saveNewsSource,
  deleteNewsSource,
  toggleNewsSourceActive,
  seedDefaultSourcesIfMissing,
  recordSourceCheck,
} from "@/lib/newsStore";
import { validateFeedUrlSsrf, safeFetchFeed } from "@/lib/sourceSecurity";
import { parseRssXml } from "@/lib/newsHarvester";

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

    // 1. Action: Seed/Sync all verified default sources
    if (body.action === "seed_defaults") {
      const seedResult = await seedDefaultSourcesIfMissing();
      const sources = await getNewsSources();
      return NextResponse.json({
        success: true,
        message: `${seedResult.added} ta yangi rasmiy manba qo‘shildi. Jami: ${seedResult.total} ta`,
        result: seedResult,
        sources,
      });
    }

    const {
      id,
      name,
      domain,
      feed_url,
      source_type = "rss",
      trust_level = "reputable_media",
      check_frequency_min = 180,
      is_active = true,
      skipVerification = false,
    } = body;

    if (!name || !feed_url) {
      return NextResponse.json(
        { success: false, error: "name va feed_url maydonlari majburiy" },
        { status: 400 }
      );
    }

    // 2. SSRF Validation
    const ssrfCheck = validateFeedUrlSsrf(feed_url);
    if (!ssrfCheck.valid) {
      return NextResponse.json(
        { success: false, error: ssrfCheck.error || "Xavfsizlik talablariga mos kelmaydigan URL" },
        { status: 400 }
      );
    }

    const normalizedUrl = ssrfCheck.normalizedUrl || feed_url.trim();
    const resolvedDomain = (domain || ssrfCheck.domain || new URL(normalizedUrl).hostname).toLowerCase();

    // 3. Deduplication Check
    const existingSources = await getNewsSources();
    const duplicate = existingSources.find(
      (s) => s.feed_url.toLowerCase().trim() === normalizedUrl.toLowerCase().trim()
    );
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `Ushbu RSS/API manzili allaqachon mavjud: "${duplicate.name}" (${duplicate.domain})`,
        },
        { status: 409 }
      );
    }

    // 4. Remote Feed Verification (test connectivity and XML format)
    let itemsFound = 0;
    if (!skipVerification) {
      try {
        const resp = await safeFetchFeed(normalizedUrl, { timeoutMs: 8000 });
        if (!resp.ok) {
          return NextResponse.json(
            {
              success: false,
              error: `Manba serveridan xato javob qaytdi: HTTP ${resp.status} ${resp.statusText}`,
            },
            { status: 400 }
          );
        }
        const xml = await resp.text();
        const parsed = parseRssXml(xml);
        itemsFound = parsed.length;
      } catch (testErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Manbaga ulanib bo‘lmadi yoki feed formati noto‘g‘ri: ${testErr?.message || testErr}`,
          },
          { status: 400 }
        );
      }
    }

    // 5. Save Source
    const saved = await saveNewsSource({
      id,
      name: name.trim(),
      domain: resolvedDomain,
      feed_url: normalizedUrl,
      source_type,
      trust_level,
      check_frequency_min,
      is_active,
    });

    // 6. Record Initial Health Check
    await recordSourceCheck({
      source_id: saved.id,
      status: itemsFound === 0 ? "empty" : "success",
      items_found: itemsFound,
      new_items_count: 0,
    });

    const sources = await getNewsSources();
    const enriched = sources.find((s) => s.id === saved.id) || saved;

    return NextResponse.json({ success: true, source: enriched });
  } catch (err: any) {
    console.error("[Sources API POST] Error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json({ success: false, error: "id va is_active (boolean) maydoni talab qilinadi" }, { status: 400 });
    }

    const updated = await toggleNewsSourceActive(id, is_active);
    return NextResponse.json({ success: true, source: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await verifyAuth(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Source id majburiy" }, { status: 400 });
    }

    const deleted = await deleteNewsSource(id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 });
  }
}
