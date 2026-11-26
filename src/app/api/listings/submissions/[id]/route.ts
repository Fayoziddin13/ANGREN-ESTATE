import { NextRequest, NextResponse } from "next/server";
import { resolveCustomer } from "@/lib/monetization/customer";
import { cancelSubmission, resubmitSubmission, validateSubmissionInput } from "@/lib/monetization/submissions";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Send a corrected application back to the admin after a revision request. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID.test(params.id)) throw new MonetizationError("not_found");
    const customer = await resolveCustomer(req, { requireActive: true });
    const body = await req.json().catch(() => null);
    const input = validateSubmissionInput(body, customer.accountId);
    const status = await resubmitSubmission(customer, params.id, input);
    return NextResponse.json({ success: true, status });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Withdraw an application that has not been decided yet (paid ones are refunded). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID.test(params.id)) throw new MonetizationError("not_found");
    const customer = await resolveCustomer(req);
    const result = await cancelSubmission(customer, params.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
