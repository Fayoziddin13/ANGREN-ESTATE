import { NextRequest, NextResponse } from "next/server";
import { resolveCustomer } from "@/lib/monetization/customer";
import { startCheckout } from "@/lib/monetization/orders";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Payment page URL for an application or sticker awaiting payment (amount decided by the server). */
export async function POST(req: NextRequest) {
  try {
    const customer = await resolveCustomer(req, { requireActive: true });
    const body = await req.json().catch(() => ({}));
    const type = body?.target_type === "boost" ? "boost" : body?.target_type === "submission" ? "submission" : null;
    if (!type || !UUID.test(String(body?.target_id || ""))) throw new MonetizationError("validation");
    const promo = typeof body?.promo_code === "string" && body.promo_code.trim() ? body.promo_code.trim().toUpperCase() : null;
    const checkout = await startCheckout(customer, { type, id: body.target_id }, promo);
    return NextResponse.json({ success: true, checkout });
  } catch (err) {
    return errorResponse(err);
  }
}
