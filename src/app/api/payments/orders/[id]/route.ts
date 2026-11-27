import { NextRequest, NextResponse } from "next/server";
import { resolveCustomer } from "@/lib/monetization/customer";
import { getOrderPaymentPage } from "@/lib/monetization/manualPayments";
import { cancelOrder } from "@/lib/monetization/orders";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Ctx = { params: { id: string } };

/** Payment page of the customer's own order: amount, card (while payable), receipts, refund. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    if (!UUID.test(params.id)) throw new MonetizationError("not_found");
    const customer = await resolveCustomer(req);
    return NextResponse.json({ success: true, data: await getOrderPaymentPage(customer, params.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** The customer cancels an unpaid order (not while a receipt is being checked). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    if (!UUID.test(params.id)) throw new MonetizationError("not_found");
    const customer = await resolveCustomer(req, { requireActive: true });
    const result = await cancelOrder(customer, params.id);
    if (result === "not_pending") throw new MonetizationError("invalid_state");
    return NextResponse.json({ success: true, data: { status: result } });
  } catch (err) {
    return errorResponse(err);
  }
}
