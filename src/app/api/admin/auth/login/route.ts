import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdmin,
  createAdminSessionToken,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  ADMIN_COOKIE_NAME,
} from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    // 1. Rate Limit Check
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many failed login attempts. Account temporarily locked.",
          retryAfterSec: rateCheck.retryAfterSec,
          locked: true,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSec || 900),
          },
        }
      );
    }

    const body = await request.json();
    const identifier = body.identifier || body.email || body.username;
    const { password, rememberMe } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username/Email and password are required." },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const authResult = authenticateAdmin(identifier, password);

    if (!authResult) {
      const failInfo = recordFailedAttempt(ip);
      return NextResponse.json(
        {
          error: "Invalid credentials. Access denied.",
          remainingAttempts: failInfo.remainingAttempts,
          locked: failInfo.isLocked,
          retryAfterSec: failInfo.retryAfterSec,
        },
        { status: 401 }
      );
    }

    // 3. Reset rate limit on success
    resetRateLimit(ip);

    // 4. Generate signed cryptographic token
    const token = createAdminSessionToken(
      authResult.username,
      authResult.email,
      Boolean(rememberMe)
    );

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60; // 30 days or 8 hours

    // 5. Create Response & attach HttpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: "Admin authentication successful.",
      admin: {
        username: authResult.username,
        email: authResult.email,
        role: "admin",
      },
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    console.error("Admin login API error:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication." },
      { status: 500 }
    );
  }
}
