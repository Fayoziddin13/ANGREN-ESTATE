import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer } from "@/lib/admin-auth";
import { requestIpHash } from "@/lib/monetization/customer";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";
import { getMonetizationSettings, updateMonetizationSettings, validateSettingsPatch } from "@/lib/monetization/settings";
import * as admin from "@/lib/monetization/admin";

export const dynamic = "force-dynamic";

/**
 * Admin API of the monetization module (/api/admin/monetization/...).
 * The middleware already requires the admin cookie; the session is read again
 * here so every action is recorded with the admin's name.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function actor(): Promise<string> {
  const session = await getAdminSessionServer();
  if (!session) throw new MonetizationError("registration_required");
  return session.username || session.email || "admin";
}

function id(value: string | undefined): string {
  if (!value || !UUID.test(value)) throw new MonetizationError("not_found");
  return value;
}

function note(body: any, required: boolean): string | null {
  const s = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (required && !s) throw new MonetizationError("reason_required");
  return s || null;
}

type Ctx = { params: { path: string[] } };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await actor();
    const [resource, sub] = params.path;
    const q = req.nextUrl.searchParams;
    let data: unknown;
    switch (resource) {
      case "stats": data = await admin.getStats(); break;
      case "settings": data = await getMonetizationSettings(); break;
      case "submissions": data = sub ? await admin.getSubmissionDetail(id(sub)) : await admin.listSubmissions(q.get("status")); break;
      case "boosts": data = await admin.listBoosts(q.get("status")); break;
      case "orders": data = await admin.listOrders(q.get("status")); break;
      case "refunds": data = await admin.listRefunds(); break;
      case "prices": data = await admin.listPrices(); break;
      case "promo-codes": data = await admin.listPromoCodes(); break;
      case "promotions": data = await admin.listPromotions(); break;
      case "accounts": data = await admin.listAccounts(); break;
      case "audit": data = await admin.listAudit(q.get("entity"), q.get("entity_id")); break;
      default: throw new MonetizationError("not_found");
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const who = await actor();
    const ip = requestIpHash(req);
    const body = await req.json().catch(() => ({}));
    const [resource, sub, action] = params.path;
    let data: unknown;

    if (resource === "submissions" && action === "approve") {
      data = await admin.approveSubmission(id(sub), who, note(body, false), ip);
    } else if (resource === "submissions" && action === "reject") {
      data = await admin.decideSubmission(id(sub), "reject", note(body, true)!, who, ip);
    } else if (resource === "submissions" && action === "revision") {
      data = await admin.decideSubmission(id(sub), "request_revision", note(body, true)!, who, ip);
    } else if (resource === "boosts" && (action === "approve" || action === "reject" || action === "revoke")) {
      data = await admin.decideBoost(id(sub), action, note(body, action !== "approve"), who);
    } else if (resource === "refunds" && action === "confirm") {
      const ref = typeof body?.provider_ref === "string" ? body.provider_ref.trim() : "";
      if (!ref) throw new MonetizationError("reference_required");
      data = await admin.confirmManualRefund(id(sub), ref, note(body, false), who);
    } else if (resource === "refunds" && action === "retry") {
      data = await admin.retryRefund(id(sub), who);
    } else if (resource === "orders" && action === "refund") {
      data = await admin.requestAdminRefund(id(sub), note(body, true)!, who);
    } else if (resource === "prices" && !sub) {
      data = await admin.setPrice(body, who);
    } else if (resource === "prices" && action === "deactivate") {
      await admin.deactivatePrice(id(sub), who);
      data = { ok: true };
    } else if (resource === "promo-codes" && !sub) {
      data = await admin.createPromoCode(body, who);
    } else if (resource === "promotions" && !sub) {
      data = await admin.createPromotion(body, who);
    } else if (resource === "accounts" && (action === "block" || action === "unblock")) {
      data = await admin.setAccountStatus(id(sub), action === "block" ? "blocked" : "active", note(body, action === "block"), who, ip);
    } else {
      throw new MonetizationError("not_found");
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const who = await actor();
    const body = await req.json().catch(() => ({}));
    const [resource, sub] = params.path;
    let data: unknown;
    if (resource === "settings" && !sub) {
      data = await updateMonetizationSettings(validateSettingsPatch(body), who, requestIpHash(req));
    } else if (resource === "submissions" && sub) {
      await admin.updateSubmissionPayload(id(sub), body, who);
      data = { ok: true };
    } else if (resource === "promo-codes" && sub) {
      data = await admin.updatePromoCode(id(sub), body, who);
    } else if (resource === "promotions" && sub) {
      data = await admin.updatePromotion(id(sub), body, who);
    } else {
      throw new MonetizationError("not_found");
    }
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const who = await actor();
    const [resource, sub] = params.path;
    if (resource === "promo-codes") await admin.deletePromoCode(id(sub), who);
    else if (resource === "promotions") await admin.deletePromotion(id(sub), who);
    else throw new MonetizationError("not_found");
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
