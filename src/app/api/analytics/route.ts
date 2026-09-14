import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const VALID_EVENT_TYPES = new Set([
  "page_view",
  "map_view",
  "property_view",
  "search",
  "filter_used",
  "favorite_add",
  "favorite_remove",
  "phone_click",
  "telegram_click",
  "property_share",
  "registration",
  "geo_visit",
]);

const VALID_DEVICES = new Set(["iPhone", "Android", "Desktop", "Tablet"]);
const VALID_TRAFFIC_SOURCES = new Set([
  "Telegram",
  "Instagram",
  "Google",
  "Yandex",
  "Direct",
  "Referral",
]);

const PHONE_REGEX = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}|\b\+?\d{9,15}\b/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PII_KEYS = new Set([
  "name",
  "full_name",
  "client_name",
  "phone",
  "telephone",
  "client_phone",
  "email",
  "telegram_handle",
  "passport",
  "inn",
]);

// 1. Trusted Client IP resolution (never trust arbitrary client x-forwarded-for prefixes)
function getTrustedClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    // Take rightmost hop to prevent client-spoofed leading hops
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return (req as any).ip || "127.0.0.1";
}

function computeIpHash(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "angren_estate_analytics_salt_2026";
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

// 2. Strict PII Detection
function containsPII(obj: any, depth = 0): boolean {
  if (!obj || typeof obj !== "object" || depth > 3) return false;
  for (const key of Object.keys(obj)) {
    const lKey = key.toLowerCase().trim();
    if (
      PII_KEYS.has(lKey) ||
      lKey.includes("phone") ||
      lKey.includes("email") ||
      lKey.includes("passport") ||
      lKey.includes("inn") ||
      lKey.includes("telegram_handle") ||
      lKey === "name" ||
      lKey === "client_name" ||
      lKey === "full_name"
    ) {
      return true;
    }
    const val = obj[key];
    if (typeof val === "string") {
      if (EMAIL_REGEX.test(val)) return true;
      if (PHONE_REGEX.test(val)) return true;
    } else if (typeof val === "object" && val !== null) {
      if (containsPII(val, depth + 1)) return true;
    }
  }
  return false;
}

// 3. Multi-Instance Rate Limiter (In-Memory Fast Layer + Atomic DB RPC)
interface RateLimitWindow {
  count: number;
  resetTime: number;
}
const memRateLimitStore = new Map<string, RateLimitWindow>();

function checkMemoryRateLimit(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const record = memRateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    if (memRateLimitStore.size > 10000) {
      for (const [k, v] of memRateLimitStore.entries()) {
        if (now > v.resetTime) memRateLimitStore.delete(k);
      }
    }
    memRateLimitStore.set(key, { count: 1, resetTime: now + windowSec * 1000 });
    return false;
  }
  record.count += 1;
  return record.count > max;
}

async function isRateLimited(sessionId: string, ipHash: string): Promise<boolean> {
  // 1. Fast in-memory evaluation (instant rejection of bursts without remote network delay)
  if (checkMemoryRateLimit(`rl:ses:${sessionId}`, 30, 60)) {
    return true;
  }
  if (checkMemoryRateLimit(`rl:ip:${ipHash}`, 60, 60)) {
    return true;
  }

  // 2. Multi-instance atomic RPC if configured in database
  try {
    const { data: sessionAllowed, error: rpcErr1 } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: `rl:ses:${sessionId}`,
      p_max: 30,
      p_window_seconds: 60,
    });
    if (!rpcErr1 && typeof sessionAllowed === "boolean") {
      if (!sessionAllowed) return true;

      const { data: ipAllowed } = await supabaseAdmin.rpc("check_rate_limit", {
        p_key: `rl:ip:${ipHash}`,
        p_max: 60,
        p_window_seconds: 60,
      });
      if (ipAllowed === false) return true;
      return false;
    }
  } catch {
    // Fall back to memory check
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Session Cookie Authority: Server is the ONLY generator of ae_session_id
    let isNewCookie = false;
    let sessionId = req.cookies.get("ae_session_id")?.value;

    if (!sessionId || !/^ses-[a-zA-Z0-9_-]{16,64}$/.test(sessionId)) {
      sessionId = `ses-${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
      isNewCookie = true;
    }

    // 2. Trusted Client IP Resolution
    const clientIp = getTrustedClientIp(req);
    const ipHash = computeIpHash(clientIp);

    // 3. Database Rate Limiting
    const rateLimited = await isRateLimited(sessionId, ipHash);
    if (rateLimited) {
      const resp = NextResponse.json(
        {
          success: false,
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many analytics events. Please slow down.",
        },
        { status: 429, headers: { "Retry-After": "60" } }
      );
      if (isNewCookie) {
        resp.cookies.set("ae_session_id", sessionId, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
          secure: process.env.NODE_ENV === "production",
        });
      }
      return resp;
    }

    // 4. Parse & Validate JSON Body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_JSON", message: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const { event_type, property_id, user_id, device, traffic_source, metadata = {} } = body;

    // Strict event_type Whitelist
    if (!event_type || !VALID_EVENT_TYPES.has(event_type)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_EVENT_TYPE",
          message: `event_type must be one of: ${Array.from(VALID_EVENT_TYPES).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Strict Device & Traffic Source Whitelist (with safe fallbacks)
    const sanitizedDevice = VALID_DEVICES.has(device) ? device : "Desktop";
    const sanitizedSource = VALID_TRAFFIC_SOURCES.has(traffic_source) ? traffic_source : "Direct";

    // Validate property_id format if provided
    if (property_id) {
      if (
        typeof property_id !== "string" ||
        property_id.length > 100 ||
        !/^prop-[a-zA-Z0-9_-]+$/.test(property_id)
      ) {
        return NextResponse.json(
          { success: false, error: "INVALID_PROPERTY_ID", message: "Invalid property_id format" },
          { status: 400 }
        );
      }
    }

    // Metadata size enforcement: Max 2048 bytes (2KB)
    if (metadata && typeof metadata === "object") {
      const serialized = JSON.stringify(metadata);
      if (serialized.length > 2048) {
        return NextResponse.json(
          {
            success: false,
            error: "METADATA_TOO_LARGE",
            message: "Metadata payload must not exceed 2048 bytes (2KB)",
          },
          { status: 400 }
        );
      }
    } else if (metadata) {
      return NextResponse.json(
        { success: false, error: "INVALID_METADATA", message: "Metadata must be a JSON object" },
        { status: 400 }
      );
    }

    // 5. Strict PII Policy: Reject with HTTP 400 and ZERO persistence
    if (containsPII(metadata)) {
      return NextResponse.json(
        {
          success: false,
          error: "PII_PROHIBITED",
          message:
            "Analytics metadata must not contain personal identifiable information (PII). Contact details belong exclusively in the leads system.",
        },
        { status: 400 }
      );
    }

    // 6. Ingestion via supabaseAdmin (service-role)
    const insertPayload = {
      event_type,
      property_id: property_id || null,
      user_id: user_id || null,
      session_id: sessionId,
      device: sanitizedDevice,
      traffic_source: sanitizedSource,
      metadata: { ...(metadata || {}), ip_hash: ipHash },
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("analytics_events")
      .insert([insertPayload])
      .select("id")
      .single();

    if (insertErr) {
      console.error("[Analytics API] Database insertion error:", insertErr.message);
      return NextResponse.json(
        { success: false, error: "STORAGE_ERROR", message: insertErr.message },
        { status: 500 }
      );
    }

    // 7. Response with Set-Cookie
    const response = NextResponse.json(
      { success: true, event_id: inserted?.id },
      { status: 201 }
    );

    if (isNewCookie) {
      response.cookies.set("ae_session_id", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (err: any) {
    console.error("[Analytics API] Unhandled exception:", err);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
