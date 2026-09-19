import { NextRequest, NextResponse } from "next/server";
import { getPublishedProperties, sanitizePublicProperty } from "@/lib/properties";
import { TransactionType, PropertyType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const rawType = searchParams.get("type") || searchParams.get("deal_type") || searchParams.get("transaction_type");
    const transaction_type =
      rawType === "sale" || rawType === "rent" ? (rawType as TransactionType) : "all";

    const district = searchParams.get("district") || undefined;

    const rawPropertyType = searchParams.get("property_type");
    const property_type = rawPropertyType as PropertyType | undefined;

    const price_min = searchParams.get("price_min") ? Number(searchParams.get("price_min")) : undefined;
    const price_max = searchParams.get("price_max") ? Number(searchParams.get("price_max")) : undefined;
    const rooms = searchParams.get("rooms") ? Number(searchParams.get("rooms")) : undefined;
    const search_query = searchParams.get("search_query") || searchParams.get("q") || undefined;

    const rawProperties = await getPublishedProperties({
      transaction_type,
      deal_type: transaction_type,
      district,
      property_type,
      price_min,
      price_max,
      rooms,
      search_query,
    });

    const properties = rawProperties.map(sanitizePublicProperty);

    return NextResponse.json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    console.error("Error in /api/properties GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch published properties" },
      { status: 500 }
    );
  }
}
