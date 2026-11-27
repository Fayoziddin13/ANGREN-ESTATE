import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, resolveCustomer } from "@/lib/monetization/customer";
import { requestBoost, validateBoostInput } from "@/lib/monetization/boosts";
import { startCheckout } from "@/lib/monetization/orders";
import { errorResponse } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

/** Buy a sticker for one of the customer's own published listings. */
export async function POST(req: NextRequest) {
  try {
    const customer = await resolveCustomer(req, { requireActive: true });
    await enforceRateLimit(`mon:boost:${customer.accountId}`, 20, 3600);
    const input = validateBoostInput(await req.json().catch(() => null));
    const result = await requestBoost(customer, input);
    let checkout = null;
    if (result.billing === "paid" && result.status === "AWAITING_PAYMENT") {
      checkout = await startCheckout(customer, { type: "boost", id: result.boost_id });
    }
    return NextResponse.json({ success: true, boost: result, checkout });
  } catch (err) {
    return errorResponse(err);
  }
}
