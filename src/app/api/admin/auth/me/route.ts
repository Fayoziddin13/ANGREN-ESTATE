import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, error: "No active admin session" },
      { status: 401 }
    );
  }

  const result = verifyAdminSessionToken(token);

  if (!result.valid || !result.session) {
    return NextResponse.json(
      { authenticated: false, error: result.error || "Invalid session" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    admin: {
      id: result.session.id,
      username: result.session.username,
      email: result.session.email,
      role: result.session.role,
      exp: result.session.exp,
    },
    user: {
      id: result.session.id,
      username: result.session.username,
      email: result.session.email,
      role: result.session.role,
      exp: result.session.exp,
    },
  });
}
