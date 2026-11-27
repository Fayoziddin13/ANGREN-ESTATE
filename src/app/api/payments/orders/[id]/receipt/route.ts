import { NextRequest, NextResponse } from "next/server";
import { resolveCustomer } from "@/lib/monetization/customer";
import { RECEIPT_MAX_BYTES, submitReceipt } from "@/lib/monetization/manualPayments";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Ctx = { params: { id: string } };

/**
 * Upload a transfer receipt (JPG / PNG / PDF, up to 10 MB). The file type is
 * checked from its bytes, the file goes to the private bucket, and the order
 * becomes RECEIPT_SUBMITTED. Only an admin can mark it paid.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    if (!UUID.test(params.id)) throw new MonetizationError("not_found");
    const length = Number(req.headers.get("content-length") || 0);
    if (length > RECEIPT_MAX_BYTES + 64 * 1024) throw new MonetizationError("invalid_receipt", "size");
    const customer = await resolveCustomer(req, { requireActive: true });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new MonetizationError("invalid_receipt", "no file");
    const noteRaw = form?.get("note");
    const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 500) : null;
    const data = await submitReceipt(customer, params.id, file, note);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
