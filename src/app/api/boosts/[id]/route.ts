import { NextRequest, NextResponse } from "next/server";
import { resolveCustomer } from "@/lib/monetization/customer";
import { cancelBoost } from "@/lib/monetization/boosts";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Withdraw a sticker request that is not active yet (a paid one is refunded). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID.test(params.id)) throw new MonetizationError("not_found");
    const customer = await resolveCustomer(req);
    return NextResponse.json({ success: true, ...(await cancelBoost(customer, params.id)) });
  } catch (err) {
    return errorResponse(err);
  }
}
