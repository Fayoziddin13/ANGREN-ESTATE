import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdmin,
  createAdminSessionToken,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  ADMIN_COOKIE_NAME,
} from "@/lib/admin-auth";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabaseServer";
import { getTrustedClientIp, hashForRateLimit } from "@/lib/requestIdentity";

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedClientIp(request);

    // 1a. Shared rate limit across all serverless instances (the in-memory store
    // below is per-instance only). Counts every attempt: 10 per IP per 15 minutes.
    if (isSupabaseConfigured) {
      try {
        const { data: allowed, error: rlError } = await supabaseAdmin.rpc("check_rate_limit", {
          p_key: `admin_login:${hashForRateLimit(ip)}`,
          p_max: 10,
          p_window_seconds: 900,
        });
        if (!rlError && allowed === false) {
          return NextResponse.json(
            {
              error: "Too many login attempts. Please try again later.",
              retryAfterSec: 900,
              locked: true,
            },
            { status: 429, headers: { "Retry-After": "900" } }
          );
        }
      } catch {
        // Fall back to the in-memory limiter below
      }
    }

    // 1b. Per-instance rate limit check
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
