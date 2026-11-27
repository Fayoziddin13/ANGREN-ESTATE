import { NextRequest, NextResponse } from "next/server";
import { mockPaymentsAllowed } from "@/lib/env/safety";
import { completeMockPayment } from "@/lib/monetization/orders";
import { errorResponse } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

/**
 * Result of the local Mock payment page, handled like a provider webhook
 * (signature check, logging, idempotent apply). Returns 404 everywhere except a
 * developer machine connected to the allow-listed test database.
 */
export async function POST(req: NextRequest) {
  if (!mockPaymentsAllowed().allowed) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const result = await completeMockPayment({
      orderId: body?.order_id,
      amount: body?.amount,
      signature: body?.sig,
      outcome: body?.outcome,
      attemptId: body?.attempt_id,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
