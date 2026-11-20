import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getVerifiedRequestUser } from "@/lib/requestIdentity";
import { SavedSearch } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_SAVED_SEARCHES = 20;
const MAX_SEARCH_BYTES = 4000;

// Saved searches are keyed by the *verified* caller only. Any userId sent by the
// client (query or body) is ignored — previously it let anyone read, overwrite
// or delete another user's searches and write arbitrary rows into app_settings.
const storageKey = (userId: string) => `saved_searches_${userId}`;

async function readList(userId: string): Promise<SavedSearch[]> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", storageKey(userId))
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.warn("[SavedSearches API] read error:", error.message);
  }
  return Array.isArray(data?.value) ? (data!.value as SavedSearch[]) : [];
}

async function writeList(userId: string, list: SavedSearch[]) {
  return supabaseAdmin.from("app_settings").upsert(
    { key: storageKey(userId), value: list, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedRequestUser(request);
    if (!user) {
      // Anonymous visitors simply have no server-side searches (local ones still work).
      return NextResponse.json({ success: true, savedSearches: [] });
    }
    return NextResponse.json({ success: true, savedSearches: await readList(user.id) });
  } catch (error) {
    console.error("[SavedSearches API] GET exception:", error);
    return NextResponse.json({ success: false, savedSearches: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedRequestUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const search = body?.search;
    if (!search || typeof search !== "object" || typeof search.id !== "string" || search.id.length > 100) {
      return NextResponse.json(
        { success: false, error: "Valid search object required" },
        { status: 400 }
      );
    }

    const sanitized: SavedSearch = { ...search, userId: user.id };
    if (JSON.stringify(sanitized).length > MAX_SEARCH_BYTES) {
      return NextResponse.json({ success: false, error: "Search is too large" }, { status: 413 });
    }

    const currentList = await readList(user.id);
    const updatedList = [sanitized, ...currentList.filter((s) => s.id !== sanitized.id)].slice(
      0,
      MAX_SAVED_SEARCHES
    );

    const { error: upsertErr } = await writeList(user.id, updatedList);
    if (upsertErr) {
      console.error("[SavedSearches API] Upsert error:", upsertErr.message);
      return NextResponse.json({ success: false, error: "Failed to save search" }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedSearches: updatedList });
  } catch (error) {
    console.error("[SavedSearches API] POST exception:", error);
    return NextResponse.json({ success: false, error: "Failed to save search" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getVerifiedRequestUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchId = new URL(request.url).searchParams.get("id");
    if (!searchId) {
      return NextResponse.json({ success: false, error: "Missing search id" }, { status: 400 });
    }

    const updatedList = (await readList(user.id)).filter((s) => s.id !== searchId);
    const { error: upsertErr } = await writeList(user.id, updatedList);
    if (upsertErr) {
      return NextResponse.json({ success: false, error: "Failed to delete search" }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedSearches: updatedList });
  } catch (error) {
    console.error("[SavedSearches API] DELETE exception:", error);
    return NextResponse.json({ success: false, error: "Failed to delete search" }, { status: 500 });
  }
}
