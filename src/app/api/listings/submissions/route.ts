import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, requestIpHash, resolveCustomer } from "@/lib/monetization/customer";
import { createSubmission, getCustomerDashboard, validateSubmissionInput } from "@/lib/monetization/submissions";
import { startCheckout } from "@/lib/monetization/orders";
import { errorResponse } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

/** The signed-in customer's applications, orders, stickers and refunds. */
export async function GET(req: NextRequest) {
  try {
    const customer = await resolveCustomer(req);
    return NextResponse.json({ success: true, ...(await getCustomerDashboard(customer)) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * New listing application. The server decides free or paid and the price; a paid
 * application waits for payment, then goes to the admin queue. Nothing is public
 * until an admin approves and publishes it.
 */
export async function POST(req: NextRequest) {
  try {
    const customer = await resolveCustomer(req, { requireActive: true });
    await enforceRateLimit(`mon:submit:${customer.accountId}`, 10, 3600);
    const body = await req.json().catch(() => null);
    const input = validateSubmissionInput(body, customer.accountId);
    const channel = req.headers.get("x-telegram-init-data") ? "telegram" : "web";
    const result = await createSubmission(customer, input, channel, requestIpHash(req));

    let checkout = null;
    if (result.billing === "paid" && result.moderation_status === "AWAITING_PAYMENT") {
      checkout = await startCheckout(customer, { type: "submission", id: result.submission_id });
    }
    return NextResponse.json({ success: true, submission: result, checkout });
  } catch (err) {
    return errorResponse(err);
  }
}
