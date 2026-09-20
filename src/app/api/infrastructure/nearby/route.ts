import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  getInfrastructureAround,
  fetchNearbyPOIsFromOverpass,
  MAX_INFRASTRUCTURE_RADIUS_METERS,
} from "@/lib/infrastructureService";
import { InfrastructureSummary } from "@/lib/types";

// In-memory server-side cache
// Key: lat(4-decimals)_lng(4-decimals)_locale_1000
// TTL: 30 minutes (1800000 ms)
interface CacheEntry {
  data: {
    success: boolean;
    source: "OpenStreetMap" | "verified_fallback";
    radiusMeters: number;
    summaries: InfrastructureSummary[];
    totalCount: number;
    message?: string;
  };
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const localeParam = (searchParams.get("locale") || "uz") as "uz" | "ru";
    const locale = localeParam === "ru" ? "ru" : "uz";

    if (!latParam || !lngParam) {
      return NextResponse.json(
        { error: "Parameters lat and lng are required" },
        { status: 400 }
      );
    }

    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Invalid coordinate values" },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${locale}_1000`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data);
    }

    let summaries: InfrastructureSummary[] = [];
    let source: "OpenStreetMap" | "verified_fallback" = "OpenStreetMap";

    // 1. PRIMARY: Fetch real OpenStreetMap POIs via Overpass API (strict 1km)
    try {
      const osmResult = await fetchNearbyPOIsFromOverpass(lat, lng, locale);
      if (osmResult && osmResult.summaries && osmResult.summaries.length > 0) {
        summaries = osmResult.summaries;
        source = "OpenStreetMap";
      }
    } catch (osmErr) {
      console.warn("[OSM/Overpass] Request failed, falling back to verified local POIs:", osmErr);
    }

    // 2. FALLBACK: If Overpass produced no results or failed, use verified municipal POIs (strictly <= 1000m)
    if (summaries.length === 0) {
      source = "verified_fallback";
      summaries = getInfrastructureAround(lat, lng, MAX_INFRASTRUCTURE_RADIUS_METERS, locale);
    }

    const totalCount = summaries.reduce((acc, s) => acc + s.count, 0);

    const emptyMessage =
      locale === "uz"
        ? "1 km radiusda infratuzilma topilmadi."
        : "В радиусе 1 км инфраструктура не найдена.";

    const responseData = {
      success: true,
      source,
      radiusMeters: MAX_INFRASTRUCTURE_RADIUS_METERS, // strictly 1000m
      summaries,
      totalCount,
      ...(totalCount === 0 ? { message: emptyMessage } : {}),
    };

    // Save to in-memory cache
    cache.set(cacheKey, {
      data: responseData,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[api/infrastructure/nearby] Internal error:", error);
    return NextResponse.json(
      { error: "Internal server error while searching infrastructure" },
      { status: 500 }
    );
  }
}
