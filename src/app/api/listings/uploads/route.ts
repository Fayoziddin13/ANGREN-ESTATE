import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, resolveCustomer } from "@/lib/monetization/customer";
import { signedPhotoUrls, uploadSubmissionPhoto } from "@/lib/monetization/uploads";
import { errorResponse, MonetizationError } from "@/lib/monetization/errors";

export const dynamic = "force-dynamic";

/**
 * Photo for an application. Stored in the private bucket under the customer's own
 * folder; the response carries a short-lived preview URL only.
 */
export async function POST(req: NextRequest) {
  try {
    const customer = await resolveCustomer(req, { requireActive: true });
    await enforceRateLimit(`mon:upload:${customer.accountId}`, 40, 3600);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new MonetizationError("upload_failed", "no file");
    const path = await uploadSubmissionPhoto(customer.accountId, file);
    const urls = await signedPhotoUrls([path], 3600);
    return NextResponse.json({ success: true, path, preview_url: urls[path] || null });
  } catch (err) {
    return errorResponse(err);
  }
}
