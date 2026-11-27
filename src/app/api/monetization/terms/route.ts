import { NextRequest, NextResponse } from "next/server";
import { normalizeE164, resolveCustomer } from "@/lib/monetization/customer";
import { getListingTerms } from "@/lib/monetization/submissions";
import { errorResponse } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

/** Price preview for a new listing: free first listing, or the price with the best discount. */
export async function POST(req: NextRequest) {
  try {
    const customer = await resolveCustomer(req);
    const body = await req.json().catch(() => ({}));
    const phone = normalizeE164(body?.contact_phone);
    const promo = typeof body?.promo_code === "string" && body.promo_code.trim() ? body.promo_code.trim().toUpperCase() : null;
    const tier = body?.listing_tier === "premium" ? "premium" : "standard";
    const terms = await getListingTerms(customer, phone, promo, tier);
    return NextResponse.json({ success: true, terms, account_status: customer.status });
  } catch (err) {
    return errorResponse(err);
  }
}
