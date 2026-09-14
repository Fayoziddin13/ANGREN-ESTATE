import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CurrencyCache {
  rate: number;
  source: string;
  date: string;
  timestamp: number;
}

let cache: CurrencyCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (3600 seconds)
const FALLBACK_RATE = 12800; // Conservative fallback

async function fetchCbuRate(): Promise<{ rate: number; date: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].Rate) {
      const parsed = parseFloat(String(data[0].Rate).replace(/\s/g, "").replace(",", "."));
      if (!isNaN(parsed) && parsed > 5000 && parsed < 50000) {
        return { rate: parsed, date: data[0].Date || new Date().toISOString().slice(0, 10) };
      }
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function fetchOpenErRate(): Promise<{ rate: number; date: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result === "success" && data?.rates?.UZS) {
      const parsed = Number(data.rates.UZS);
      if (!isNaN(parsed) && parsed > 5000 && parsed < 50000) {
        return {
          rate: parsed,
          date: data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        };
      }
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  // Return cached rate if still within 1-hour TTL
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        success: true,
        rate: cache.rate,
        source: cache.source,
        date: cache.date,
        timestamp: cache.timestamp,
        cached: true,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  }

  // Primary: Central Bank of Uzbekistan (CBU) official rate
  const cbuResult = await fetchCbuRate();
  if (cbuResult) {
    cache = {
      rate: cbuResult.rate,
      source: "cbu.uz",
      date: cbuResult.date,
      timestamp: now,
    };
    return NextResponse.json(
      {
        success: true,
        rate: cache.rate,
        source: cache.source,
        date: cache.date,
        timestamp: cache.timestamp,
        cached: false,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  }

  // Fallback 1: Open Exchange Rates API
  const erResult = await fetchOpenErRate();
  if (erResult) {
    cache = {
      rate: erResult.rate,
      source: "open.er-api.com",
      date: erResult.date,
      timestamp: now,
    };
    return NextResponse.json(
      {
        success: true,
        rate: cache.rate,
        source: cache.source,
        date: cache.date,
        timestamp: cache.timestamp,
        cached: false,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  }

  // Fallback 2: Existing cache if available, else static default rate
  const fallbackRate = cache ? cache.rate : FALLBACK_RATE;
  return NextResponse.json(
    {
      success: true,
      rate: fallbackRate,
      source: cache ? cache.source + " (stale)" : "static_fallback",
      date: cache ? cache.date : new Date().toISOString().slice(0, 10),
      timestamp: now,
      cached: false,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300",
      },
    }
  );
}