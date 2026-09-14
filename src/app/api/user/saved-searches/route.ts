import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { SavedSearch } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: true, savedSearches: [] });
    }

    const key = `saved_searches_${userId}`;
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("[SavedSearches API] GET error:", error.message);
    }

    const savedSearches: SavedSearch[] = Array.isArray(data?.value) ? data.value : [];
    return NextResponse.json({ success: true, savedSearches });
  } catch (error) {
    console.error("[SavedSearches API] GET exception:", error);
    return NextResponse.json({ success: false, savedSearches: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, search } = body;

    if (!userId || !search || !search.id) {
      return NextResponse.json(
        { success: false, error: "userId and valid search object required" },
        { status: 400 }
      );
    }

    const key = `saved_searches_${userId}`;

    // Read existing
    const { data: existingData } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    const currentList: SavedSearch[] = Array.isArray(existingData?.value) ? existingData.value : [];
    const updatedList = [search, ...currentList.filter((s) => s.id !== search.id)].slice(0, 20);

    const { error: upsertErr } = await supabaseAdmin.from("app_settings").upsert(
      {
        key,
        value: updatedList,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (upsertErr) {
      console.error("[SavedSearches API] Upsert error:", upsertErr.message);
      return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedSearches: updatedList });
  } catch (error) {
    console.error("[SavedSearches API] POST exception:", error);
    return NextResponse.json({ success: false, error: "Failed to save search" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const searchId = searchParams.get("id");

    if (!userId || !searchId) {
      return NextResponse.json({ success: false, error: "Missing userId or searchId" }, { status: 400 });
    }

    const key = `saved_searches_${userId}`;
    const { data: existingData } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    const currentList: SavedSearch[] = Array.isArray(existingData?.value) ? existingData.value : [];
    const updatedList = currentList.filter((s) => s.id !== searchId);

    const { error: upsertErr } = await supabaseAdmin.from("app_settings").upsert(
      {
        key,
        value: updatedList,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (upsertErr) {
      return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedSearches: updatedList });
  } catch (error) {
    console.error("[SavedSearches API] DELETE exception:", error);
    return NextResponse.json({ success: false, error: "Failed to delete search" }, { status: 500 });
  }
}
