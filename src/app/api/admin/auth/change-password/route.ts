import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  checkRateLimit,
  createAdminSessionToken,
  getAdminSessionServer,
  recordFailedAttempt,
  resetRateLimit,
} from "@/lib/admin-auth";
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  checkAdminPassword,
  saveAdminPassword,
  validateNewAdminPassword,
} from "@/lib/adminCredentials";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabaseServer";
import { getTrustedClientIp, hashForRateLimit } from "@/lib/requestIdentity";

export const dynamic = "force-dynamic";

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/** Rejects cross-site requests: the browser always sends Origin on POST. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // 1. Only a signed-in admin (session cookie) on this site may change the password.
  const session = await getAdminSessionServer();
  if (!session) return fail(401, "UNAUTHORIZED");
  if (!isSameOrigin(request)) return fail(403, "FORBIDDEN_ORIGIN");
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return fail(415, "UNSUPPORTED_MEDIA_TYPE");
  }

  // 2. The new password is stored in Supabase; without it there is nowhere safe to keep it.
  if (!isSupabaseConfigured) return fail(503, "STORE_UNAVAILABLE");

  // 3. Rate limits: shared across instances (5 per IP per 15 min) + per instance.
  const ip = getTrustedClientIp(request);
  const limiterKey = `pwchange:${ip}`;
  try {
    const { data: allowed, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: `admin_pwchange:${hashForRateLimit(ip)}`,
      p_max: 5,
      p_window_seconds: 900,
    });
    if (!error && allowed === false) {
      return fail(429, "RATE_LIMITED", { retryAfterSec: 900 });
    }
  } catch {
    // fall through to the in-memory limiter
  }
  const local = checkRateLimit(limiterKey);
  if (!local.allowed) return fail(429, "RATE_LIMITED", { retryAfterSec: local.retryAfterSec });

  // 4. Input
  let body: any;
  try {
    body = await request.json();
  } catch {
    return fail(400, "INVALID_JSON");
  }
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";
  if (!currentPassword || !newPassword || !confirmPassword) return fail(400, "MISSING_FIELDS");
  if (currentPassword.length > ADMIN_PASSWORD_MAX_LENGTH * 2) return fail(400, "WRONG_CURRENT");

  // 5. Current password must be right (panel-set password or ADMIN_PASSWORD).
  const check = await checkAdminPassword(currentPassword);
  if (check === "unavailable") return fail(503, "STORE_UNAVAILABLE");
  if (check === "invalid") {
    const info = recordFailedAttempt(limiterKey);
    return fail(400, "WRONG_CURRENT", { remainingAttempts: info.remainingAttempts });
  }

  // 6. New password policy (also enforced in the form).
  const policyError = validateNewAdminPassword(newPassword, confirmPassword, currentPassword);
  if (policyError) return fail(400, policyError);

  // 7. Store the salted PBKDF2 hash server-side.
  const saved = await saveAdminPassword(newPassword);
  if (!saved) return fail(500, "SAVE_FAILED");

  resetRateLimit(limiterKey);
  console.info("[AdminAuth] Admin password changed from the admin panel.");

  // 8. Keep this browser signed in with a freshly issued session.
  const token = createAdminSessionToken(session.username, session.email, Boolean(session.rememberMe));
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60,
  });
  return response;
}
