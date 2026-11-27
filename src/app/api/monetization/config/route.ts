import { NextResponse } from "next/server";
import { getMonetizationSettings } from "@/lib/monetization/settings";
import { getPublicPriceList } from "@/lib/monetization/boosts";
import { getActivePaymentMethod } from "@/lib/monetization/manualPayments";
import { devToolsAllowed } from "@/lib/env/safety";

export const dynamic = "force-dynamic";

/**
 * Public monetization switches and price list, used by the site to decide which
 * application form to show. If the monetization tables are not there (e.g. before
 * the migration), it reports "disabled" so the site keeps its old behaviour.
 */
export async function GET() {
  try {
    const settings = await getMonetizationSettings();
    const prices = settings.enabled ? await getPublicPriceList() : { listing: null, premium: null, stickers: [] };
    const method = settings.enabled ? await getActivePaymentMethod().catch(() => null) : null;
    return NextResponse.json({
      success: true,
      enabled: settings.enabled,
      listing_payment_enabled: settings.listing_payment_enabled,
      sticker_payment_enabled: settings.sticker_payment_enabled,
      free_first_listing_enabled: settings.free_first_listing_enabled,
      free_listing_limit: settings.free_listing_limit,
      prices,
      premium_features: settings.premium_features ?? [],
      payment_method: "manual_card",
      payments_available: Boolean(method?.accepting),
      dev_tools: devToolsAllowed().allowed,
    });
  } catch {
    return NextResponse.json({ success: true, enabled: false, prices: { listing: null, premium: null, stickers: [] }, payments_available: false, dev_tools: false });
  }
}
