import { NextRequest, NextResponse } from "next/server";
import { testSupabaseConnection, isSupabaseConfigured } from "@/lib/supabase";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";

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

    const connectionInfo = await testSupabaseConnection();

    return NextResponse.json({
      success: true,
      status: connectionInfo,
      rlsEnabled: true,
      schemaFile: "supabase/migrations/20260910_canonical_supabase_schema.sql",
      configured: isSupabaseConfigured,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to test connection" },
      { status: 500 }
    );
  }
}
