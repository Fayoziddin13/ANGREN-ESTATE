import { NextResponse } from "next/server";
import { getMonetizationSettings } from "@/lib/monetization/settings";
import { getPublicPriceList } from "@/lib/monetization/boosts";
import { getPaymentProvider } from "@/lib/monetization/payments";
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
    const prices = settings.enabled ? await getPublicPriceList() : { listing: null, stickers: [] };
    return NextResponse.json({
      success: true,
      enabled: settings.enabled,
      listing_payment_enabled: settings.listing_payment_enabled,
      sticker_payment_enabled: settings.sticker_payment_enabled,
      free_first_listing_enabled: settings.free_first_listing_enabled,
      free_listing_limit: settings.free_listing_limit,
      prices,
      payments_available: Boolean(getPaymentProvider()),
      dev_tools: devToolsAllowed().allowed,
    });
  } catch {
    return NextResponse.json({ success: true, enabled: false, prices: { listing: null, stickers: [] }, payments_available: false, dev_tools: false });
  }
}
