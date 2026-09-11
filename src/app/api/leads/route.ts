import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";

const DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds deduplication window
const INQUIRY_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes rate limit window for inquiries
const MAX_INQUIRIES_PER_WINDOW = 5;

// Trusted Client IP resolution (never trust arbitrary client x-forwarded-for prefixes)
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
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return (req as any).ip || "127.0.0.1";
}

function computeIpHash(req: NextRequest): string {
  const ip = getTrustedClientIp(req);
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "angren_estate_ip_salt_2026";
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      property_id: rawPropertyId,
      type,
      property_title: rawTitle,
      property_slug: rawSlug,
      realtor_id: rawRealtorId,
      client_name,
      client_phone,
      message,
      device = "Desktop",
      traffic_source = "Direct",
      metadata = {},
    } = body;

    const validTypes = ["phone", "telegram", "inquiry"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: "type must be phone, telegram, or inquiry" },
        { status: 400 }
      );
    }

    // Support general consultation inquiries (e.g. from /kontaktlar page)
    const isGeneralInquiry =
      type === "inquiry" &&
      (!rawPropertyId || rawPropertyId === "general" || rawPropertyId === "contact_page");

    if (!isGeneralInquiry && (!rawPropertyId || typeof rawPropertyId !== "string")) {
      return NextResponse.json(
        { success: false, error: "property_id is required for listing interactions" },
        { status: 400 }
      );
    }

    const property_id = isGeneralInquiry ? null : rawPropertyId;

    // Strict validation for inquiries
    if (type === "inquiry") {
      const name = String(client_name || "").trim();
      const phone = String(client_phone || "").trim().replace(/[\s\(\)\-]/g, "");

      if (name.length < 2 || name.length > 100) {
        return NextResponse.json(
          { success: false, error: "client_name must be between 2 and 100 characters" },
          { status: 400 }
        );
      }

      if (!/^\+?\d{9,15}$/.test(phone)) {
        return NextResponse.json(
          { success: false, error: "client_phone must be a valid phone number" },
          { status: 400 }
        );
      }
    }

    const ipHash = computeIpHash(req);

    // Rate Limiting for general inquiries: Max 5 inquiries per 10 minutes per IP
    if (type === "inquiry") {
      const rateLimitStart = new Date(Date.now() - INQUIRY_RATE_LIMIT_WINDOW_MS).toISOString();
      try {
        const { count: inquiryCount } = await supabaseAdmin
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("type", "inquiry")
          .eq("ip_hash", ipHash)
          .gte("created_at", rateLimitStart);

        if (inquiryCount !== null && inquiryCount >= MAX_INQUIRIES_PER_WINDOW) {
          return NextResponse.json(
            {
              success: false,
              error: "RATE_LIMIT_EXCEEDED",
              message: "Too many inquiries submitted. Please try again later.",
            },
            { status: 429, headers: { "Retry-After": "600" } }
          );
        }
      } catch (rateLimitErr) {
        // Continue if rate limit check fails non-critically
      }
    }

    // Deduplication check: recent lead with same (property_id, type, ip_hash) within 60s
    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    try {
      let dedupQuery = supabaseAdmin
        .from("leads")
        .select("id, created_at")
        .eq("type", type)
        .eq("ip_hash", ipHash)
        .gte("created_at", windowStart);

      if (property_id) {
        dedupQuery = dedupQuery.eq("property_id", property_id);
      } else {
        dedupQuery = dedupQuery.is("property_id", null);
      }

      const { data: existingLeads } = await dedupQuery.limit(1);

      if (existingLeads && existingLeads.length > 0) {
        return NextResponse.json(
          {
            success: true,
            duplicate: true,
            message: "Lead recorded recently; deduplicated within 60s window.",
          },
          { status: 200 }
        );
      }
    } catch (dedupErr) {
      // Continue if dedup query fails non-critically
    }

    // Resolve property metadata & assigned realtor
    let propertyTitle = isGeneralInquiry
      ? rawTitle || "Umumiy murojaat (Aloqa sahifasi)"
      : rawTitle;
    let propertySlug = isGeneralInquiry ? rawSlug || "aloqa-sahifasi" : rawSlug;
    let realtorId = rawRealtorId;

    if (property_id) {
      try {
        const { data: prop } = await supabaseAdmin
          .from("properties")
          .select("id, title_uz, slug, realtor_id")
          .eq("id", property_id)
          .single();

        if (prop) {
          propertyTitle = propertyTitle || prop.title_uz;
          propertySlug = propertySlug || prop.slug;
          realtorId = realtorId || prop.realtor_id;
        }
      } catch {
        // Non-blocking property lookup
      }
    }

    // Insert lead record into Supabase public.leads
    const newLeadRow = {
      property_id,
      realtor_id: realtorId || null,
      type,
      status: "new",
      property_title: propertyTitle || null,
      property_slug: propertySlug || null,
      client_name: client_name ? String(client_name).trim().slice(0, 100) : null,
      client_phone: client_phone ? String(client_phone).trim().slice(0, 50) : null,
      message: message ? String(message).trim().slice(0, 1000) : null,
      notes: null,
      device: typeof device === "string" ? device.slice(0, 50) : "Desktop",
      traffic_source: typeof traffic_source === "string" ? traffic_source.slice(0, 50) : "Direct",
      ip_hash: ipHash,
      metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: insertedLead, error: insertError } = await supabaseAdmin
      .from("leads")
      .insert([newLeadRow])
      .select("id, created_at, status")
      .single();

    if (insertError) {
      console.error("[Leads API] Insert into public.leads failed:", insertError.message);
      return NextResponse.json(
        {
          success: false,
          error: insertError.message,
          hint: "Ensure public.leads table exists by applying migration supabase/migrations/20260910_leads_system.sql in Supabase SQL Editor",
        },
        { status: 500 }
      );
    }

    // Concurrency-safe atomic increment of properties.contacts_count (only for property leads)
    if (property_id) {
      try {
        await supabaseAdmin.rpc("increment_property_contacts", {
          p_property_id: property_id,
        });
      } catch (rpcErr: any) {
        // Non-blocking counter increment
      }
    }

    return NextResponse.json(
      {
        success: true,
        lead: insertedLead,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Leads API] Uncaught error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
