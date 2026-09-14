import { AnalyticsEventType, AnalyticsEvent } from "./types";

// Purge legacy analytics storage on load (Zero production localStorage/sessionStorage)
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("angren_estate_analytics_events_v1");
    sessionStorage.removeItem("angren_estate_session_id_v1");
  } catch {
    // Ignore environments with restricted storage
  }
}

const EVENTS_CHANGE_EVENT = "angren_estate_analytics_change";

// 1. Detect device type responsibly
export function getDeviceType(): "iPhone" | "Android" | "Desktop" | "Tablet" {
  if (typeof window === "undefined") return "Desktop";
  const ua = navigator.userAgent || "";
  if (/iPad/i.test(ua)) return "Tablet";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? "Android" : "Tablet";
  }
  return "Desktop";
}

// 2. Detect traffic source
export function getTrafficSource(): "Telegram" | "Instagram" | "Google" | "Yandex" | "Direct" | "Referral" {
  if (typeof window === "undefined") return "Direct";
  const ref = document.referrer.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = (searchParams.get("utm_source") || "").toLowerCase();

  if (utmSource.includes("tg") || utmSource.includes("telegram") || ref.includes("t.me") || ref.includes("telegram")) {
    return "Telegram";
  }
  if (utmSource.includes("insta") || ref.includes("instagram.com")) {
    return "Instagram";
  }
  if (utmSource.includes("google") || ref.includes("google.")) {
    return "Google";
  }
  if (utmSource.includes("yandex") || ref.includes("yandex.")) {
    return "Yandex";
  }
  if (ref && !ref.includes(window.location.hostname)) {
    return "Referral";
  }
  return "Direct";
}

// 3. Track event helper (Server is the ONLY authority for session ID; cookie sent via credentials: "include")
export async function trackEvent(
  eventType: AnalyticsEventType,
  payload?: {
    property_id?: string;
    user_id?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }
): Promise<void> {
  if (typeof window === "undefined") return;

  const { property_id, user_id, metadata, ...rest } = payload || {};
  const combinedMetadata = { ...(metadata || {}), ...rest };

  const eventBody = {
    event_type: eventType,
    property_id,
    user_id,
    device: getDeviceType(),
    traffic_source: getTrafficSource(),
    metadata: combinedMetadata,
  };

  try {
    // Asynchronous dispatch with keepalive: true and credentials: "include" for HttpOnly session cookie
    fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(eventBody),
    }).catch((err) => {
      console.warn("[Analytics] Dispatch warning:", err);
    });

    // Notify open admin tabs via local DOM event (no storage used)
    window.dispatchEvent(new Event(EVENTS_CHANGE_EVENT));
  } catch (e) {
    console.warn("[Analytics] Track event error:", e);
  }
}

// 4. Debounced & Deduplicated Search Tracking
let searchDebounceTimer: NodeJS.Timeout | null = null;
let lastEmittedSearchQuery = "";

export function trackSearchDebounced(query: string) {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();

  if (trimmed.length < 3) return; // Skip trivial queries
  if (trimmed.toLowerCase() === lastEmittedSearchQuery.toLowerCase()) return; // Skip identical repeated queries

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  searchDebounceTimer = setTimeout(() => {
    lastEmittedSearchQuery = trimmed;
    trackEvent("search", {
      metadata: {
        query_length: trimmed.length,
        search_term: trimmed.slice(0, 50),
      },
    });
  }, 1000); // 1000ms minimum debounce
}

// 5. Deduplicated Filter Tracking
let lastEmittedFilterHash = "";
let lastFilterTime = 0;

export function trackFilterChange(filters: Record<string, any>) {
  if (typeof window === "undefined") return;
  const now = Date.now();

  // 3000ms minimum cooldown between filter change events
  if (now - lastFilterTime < 3000) return;

  const hash = JSON.stringify(filters);
  if (hash === lastEmittedFilterHash) return; // Skip identical filter states

  lastEmittedFilterHash = hash;
  lastFilterTime = now;

  trackEvent("filter_used", {
    metadata: filters,
  });
}

// 6. Pure backward-compatibility stub (Zero localStorage in production)
export function getLoggedAnalyticsEvents(): AnalyticsEvent[] {
  return [];
}
