import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionServer, verifyAdminSessionToken } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import {
  AnalyticsDashboardPayload,
  AnalyticsKPISummary,
  AnalyticsDeviceStat,
  AnalyticsTrafficSourceStat,
  AnalyticsDemandStat,
  AnalyticsDistrictStat,
  AnalyticsOutcomesStat,
  AnalyticsEvent,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function verifyAuth(request: NextRequest) {
  const session = await getAdminSessionServer();
  if (session && session.role === "admin") return session;

  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.valid && verified.session && verified.session.role === "admin") {
      return verified.session;
    }
  }

  return null;
}

function calculateStartDate(range: string): string | null {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "30d": {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "3m": {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "6m": {
      const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "1y": {
      const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "all":
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Admin Authentication Check
    const session = await verifyAuth(req);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";
    const startDate = calculateStartDate(range);

    // 2. Performance Benchmark for Database Aggregation Target (< 500ms)
    const dbStart = performance.now();

    // Query 1: Analytics Events within range
    let eventsQuery = supabaseAdmin
      .from("analytics_events")
      .select("id, event_type, session_id, device, traffic_source, property_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (startDate) {
      eventsQuery = eventsQuery.gte("created_at", startDate);
    }

    // Query 2: Properties for supply & outcomes (needed columns)
    const propertiesQuery = supabaseAdmin
      .from("properties")
      .select("id, status, property_type, district_name_uz, views_count, price, price_usd, area_sqm, created_at, updated_at");

    // Query 3: Leads count for separate lead tracking
    let leadsQuery = supabaseAdmin
      .from("leads")
      .select("id, created_at, status, property_id");

    if (startDate) {
      leadsQuery = leadsQuery.gte("created_at", startDate);
    }

    const [eventsRes, propertiesRes, leadsRes] = await Promise.all([
      eventsQuery,
      propertiesQuery,
      leadsQuery,
    ]);

    const dbDurationMs = Math.round(performance.now() - dbStart);

    const rawEvents: AnalyticsEvent[] = eventsRes.data || [];
    const rawProperties: any[] = propertiesRes.data || [];
    const rawLeads: any[] = leadsRes.data || [];

    // 3. Aggregate KPIs & Sessions
    let pageViews = 0;
    let phoneClicks = 0;
    let telegramClicks = 0;
    let favoritesAdds = 0;
    let searches = 0;

    interface SessionInfo {
      first: number;
      last: number;
      count: number;
      hasConversionAction: boolean;
    }

    const sessionMap = new Map<string, SessionInfo>();

    const deviceCounts: Record<string, number> = {
      iPhone: 0,
      Android: 0,
      Desktop: 0,
      Tablet: 0,
    };

    const sourceCounts: Record<string, number> = {
      Telegram: 0,
      Instagram: 0,
      Google: 0,
      Direct: 0,
      Referral: 0,
    };

    for (const evt of rawEvents) {
      const isConversionAction =
        evt.event_type === "phone_click" || evt.event_type === "telegram_click";

      if (evt.session_id) {
        const ts = evt.created_at ? new Date(evt.created_at).getTime() : 0;
        const existing = sessionMap.get(evt.session_id);
        if (!existing) {
          sessionMap.set(evt.session_id, {
            first: ts,
            last: ts,
            count: 1,
            hasConversionAction: isConversionAction,
          });
        } else {
          existing.count++;
          if (ts > 0 && (existing.first === 0 || ts < existing.first)) {
            existing.first = ts;
          }
          if (ts > existing.last) {
            existing.last = ts;
          }
          if (isConversionAction) {
            existing.hasConversionAction = true;
          }
        }
      }

      switch (evt.event_type) {
        case "page_view":
          pageViews++;
          break;
        case "phone_click":
          phoneClicks++;
          break;
        case "telegram_click":
          telegramClicks++;
          break;
        case "favorite_add":
          favoritesAdds++;
          break;
        case "search":
        case "filter_used":
          searches++;
          break;
      }

      // Device aggregation
      if (evt.device && deviceCounts[evt.device] !== undefined) {
        deviceCounts[evt.device]++;
      } else {
        deviceCounts["Desktop"]++;
      }

      // Source aggregation
      if (evt.traffic_source && sourceCounts[evt.traffic_source] !== undefined) {
        sourceCounts[evt.traffic_source]++;
      } else {
        sourceCounts["Direct"]++;
      }
    }

    const uniqueVisitors = sessionMap.size || (rawEvents.length > 0 ? 1 : 0);
    const totalVisits = Math.max(pageViews, uniqueVisitors);

    // Calculate real average session duration from recorded event timestamps
    let totalDurationSeconds = 0;
    let singleEventSessions = 0;
    for (const [, s] of sessionMap.entries()) {
      if (s.count === 1) {
        singleEventSessions++;
      }
      if (s.last > s.first && s.first > 0) {
        totalDurationSeconds += Math.round((s.last - s.first) / 1000);
      }
    }

    const avgDurationSec =
      sessionMap.size > 0 ? Math.round(totalDurationSeconds / sessionMap.size) : 0;
    const mins = Math.floor(avgDurationSec / 60);
    const secs = avgDurationSec % 60;
    const avgSessionStr = `${mins}m ${secs.toString().padStart(2, "0")}s`;

    // Real bounce rate: sessions with exactly 1 event / total unique sessions
    const bounceRateStr =
      sessionMap.size > 0
        ? `${((singleEventSessions / sessionMap.size) * 100).toFixed(1)}%`
        : "0.0%";

    // Non-double-counted unique session conversion rate:
    // Count unique sessions that performed at least one phone_click or telegram_click
    let convertingSessionsCount = 0;
    for (const [, s] of sessionMap.entries()) {
      if (s.hasConversionAction) {
        convertingSessionsCount++;
      }
    }

    const conversionRateStr =
      uniqueVisitors > 0
        ? `${((convertingSessionsCount / uniqueVisitors) * 100).toFixed(1)}%`
        : "0.0%";

    const kpis: AnalyticsKPISummary = {
      total_visits: totalVisits,
      unique_visitors: uniqueVisitors,
      phone_calls: phoneClicks,
      telegram_chats: telegramClicks,
      favorites_added: favoritesAdds,
      searches_executed: searches,
      avg_session: avgSessionStr,
      bounce_rate: bounceRateStr,
    };

    // 4. Device Distribution
    const totalDeviceEvents =
      deviceCounts.iPhone + deviceCounts.Android + deviceCounts.Desktop + deviceCounts.Tablet;

    const devices: AnalyticsDeviceStat[] = [
      {
        name: "Apple iPhone (iOS)",
        count: deviceCounts.iPhone,
        percent: totalDeviceEvents > 0 ? Math.round((deviceCounts.iPhone / totalDeviceEvents) * 100) : 0,
      },
      {
        name: "Android Smartphone",
        count: deviceCounts.Android,
        percent: totalDeviceEvents > 0 ? Math.round((deviceCounts.Android / totalDeviceEvents) * 100) : 0,
      },
      {
        name: "Desktop (Chrome / Mac / Win)",
        count: deviceCounts.Desktop,
        percent: totalDeviceEvents > 0 ? Math.round((deviceCounts.Desktop / totalDeviceEvents) * 100) : 0,
      },
      {
        name: "Tablet (iPad / Android Tablet)",
        count: deviceCounts.Tablet,
        percent: totalDeviceEvents > 0 ? Math.round((deviceCounts.Tablet / totalDeviceEvents) * 100) : 0,
      },
    ];

    // 5. Traffic Sources Distribution
    const totalSourcesEvents =
      sourceCounts.Telegram +
      sourceCounts.Instagram +
      sourceCounts.Google +
      sourceCounts.Direct +
      sourceCounts.Referral;

    const traffic_sources: AnalyticsTrafficSourceStat[] = [
      {
        name: "Telegram kanallar va guruhlar",
        visits: sourceCounts.Telegram,
        percent: totalSourcesEvents > 0 ? Math.round((sourceCounts.Telegram / totalSourcesEvents) * 100) : 0,
        color: "bg-sky-500",
      },
      {
        name: "Instagram stories va bio link",
        visits: sourceCounts.Instagram,
        percent: totalSourcesEvents > 0 ? Math.round((sourceCounts.Instagram / totalSourcesEvents) * 100) : 0,
        color: "bg-pink-500",
      },
      {
        name: "Google Qidiruv (SEO organik)",
        visits: sourceCounts.Google,
        percent: totalSourcesEvents > 0 ? Math.round((sourceCounts.Google / totalSourcesEvents) * 100) : 0,
        color: "bg-emerald-500",
      },
      {
        name: "To‘g‘ridan-to‘g‘ri (Direct / Bookmark)",
        visits: sourceCounts.Direct,
        percent: totalSourcesEvents > 0 ? Math.round((sourceCounts.Direct / totalSourcesEvents) * 100) : 0,
        color: "bg-amber-500",
      },
    ];

    // 6. Property Types Demand Breakdown (Real Views from Database)
    const typeViews: Record<string, number> = {
      apartment: 0,
      house: 0,
      commercial: 0,
      land: 0,
    };

    for (const prop of rawProperties) {
      const pt = prop.property_type || "apartment";
      if (typeViews[pt] !== undefined) {
        typeViews[pt] += prop.views_count || 0;
      }
    }

    const totalTypeViews =
      typeViews.apartment + typeViews.house + typeViews.commercial + typeViews.land;

    const property_types_demand: AnalyticsDemandStat[] = [
      {
        type_uz: "Kvartiralar",
        type_ru: "Квартиры",
        percentage: totalTypeViews > 0 ? Math.round((typeViews.apartment / totalTypeViews) * 100) : 0,
        views: typeViews.apartment,
        growth: "—",
      },
      {
        type_uz: "Hovli va Kottejlar",
        type_ru: "Дома и коттеджи",
        percentage: totalTypeViews > 0 ? Math.round((typeViews.house / totalTypeViews) * 100) : 0,
        views: typeViews.house,
        growth: "—",
      },
      {
        type_uz: "Tijorat maydonlari",
        type_ru: "Коммерческая",
        percentage: totalTypeViews > 0 ? Math.round((typeViews.commercial / totalTypeViews) * 100) : 0,
        views: typeViews.commercial,
        growth: "—",
      },
      {
        type_uz: "Yer uchastkalari",
        type_ru: "Земельные участки",
        percentage: totalTypeViews > 0 ? Math.round((typeViews.land / totalTypeViews) * 100) : 0,
        views: typeViews.land,
        growth: "—",
      },
    ];

    // 7. Districts Demand & Supply Breakdown (Real Database Calculations)
    const districtConfigs = [
      { name_uz: "Angren Markazi", name_ru: "Центр Ангрена", filter: "Markaz" },
      { name_uz: "5/1 dahasi", name_ru: "Массив 5/1", filter: "5/1" },
      { name_uz: "Dukent daryosi bo‘yi", name_ru: "Берег Дукента", filter: "Dukent" },
      { name_uz: "Yangiobod mavzesi", name_ru: "Массив Янгиабад", filter: "Yangiobod" },
    ];

    const districts_data: AnalyticsDistrictStat[] = districtConfigs.map((cfg) => {
      const matched = rawProperties.filter((p) =>
        (p.district_name_uz || "").includes(cfg.filter)
      );
      const views = matched.reduce((sum, p) => sum + (p.views_count || 0), 0);
      const supply = matched.filter((p) => p.status === "published").length;
      const closed = matched.filter((p) => p.status === "sold" || p.status === "rented");

      // Calculate real average price per sqm
      const validPriceProps = matched.filter(
        (p) => Number(p.price) > 0 && Number(p.area_sqm) > 0
      );
      let avgPriceSqm = "—";
      if (validPriceProps.length > 0) {
        const sumPerSqm = validPriceProps.reduce(
          (sum, p) => sum + Number(p.price) / Number(p.area_sqm),
          0
        );
        const avg = sumPerSqm / validPriceProps.length;
        avgPriceSqm = `${(avg / 1_000_000).toFixed(1)} mln UZS`;
      }

      // Real days on market for closed properties
      let avgDays = 0;
      if (closed.length > 0) {
        const totalDays = closed.reduce((sum, p) => {
          if (p.created_at && p.updated_at) {
            const diff = Math.max(
              1,
              Math.round(
                (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            return sum + diff;
          }
          return sum + 0;
        }, 0);
        avgDays = Math.round(totalDays / closed.length);
      }

      // Searches from real search/filter events
      const districtSearches = rawEvents.filter((e) => {
        if (e.event_type !== "search" && e.event_type !== "filter_used") return false;
        const meta = JSON.stringify(e.metadata || "").toLowerCase();
        return meta.includes(cfg.filter.toLowerCase());
      }).length;

      let ratio = "Barqaror balans";
      let ratio_ru = "Стабильный баланс";
      let ratio_color = "blue";

      if (supply === 0 && views > 0) {
        ratio = "Talab yuqori (Defitsit)";
        ratio_ru = "Высокий спрос (Дефицит)";
        ratio_color = "emerald";
      } else if (supply > 0 && views === 0) {
        ratio = "Taklif yetarli";
        ratio_ru = "Достаточное предложение";
        ratio_color = "slate";
      } else if (views > 20) {
        ratio = "Faol talab";
        ratio_ru = "Активный спрос";
        ratio_color = "emerald";
      }

      return {
        name_uz: cfg.name_uz,
        name_ru: cfg.name_ru,
        views,
        searches: districtSearches,
        supply_count: supply,
        avg_price_sqm: avgPriceSqm,
        closed_deals: closed.length,
        avg_days_on_market: avgDays,
        ratio,
        ratio_ru,
        ratio_color,
      };
    });

    // 8. Outcomes & Deal Velocity
    const soldCount = rawProperties.filter((p) => p.status === "sold").length;
    const rentedCount = rawProperties.filter((p) => p.status === "rented").length;
    const activeSupply = rawProperties.filter((p) => p.status === "published").length;
    const closedDeals = soldCount + rentedCount;

    const allClosedProps = rawProperties.filter(
      (p) => p.status === "sold" || p.status === "rented"
    );
    let overallAvgDaysOnMarket = 0;
    if (allClosedProps.length > 0) {
      const sumDays = allClosedProps.reduce((sum, p) => {
        if (p.created_at && p.updated_at) {
          const diff = Math.max(
            1,
            Math.round(
              (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
          return sum + diff;
        }
        return sum + 0;
      }, 0);
      overallAvgDaysOnMarket = Math.round(sumDays / allClosedProps.length);
    }

    const outcomes: AnalyticsOutcomesStat = {
      closed_deals: closedDeals,
      sold_count: soldCount,
      rented_count: rentedCount,
      active_supply: activeSupply,
      avg_days_on_market: overallAvgDaysOnMarket,
      conversion_rate: conversionRateStr,
      total_leads: rawLeads.length,
    };

    // 9. Recent Events Stream (50 latest)
    const recent_events = rawEvents.slice(0, 50);

    const payload: AnalyticsDashboardPayload = {
      success: true,
      range,
      db_duration_ms: dbDurationMs,
      kpis,
      devices,
      traffic_sources,
      property_types_demand,
      districts_data,
      outcomes,
      recent_events,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error("[Admin Analytics API] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: error?.message || "Failed to load analytics" },
      { status: 500 }
    );
  }
}
