"use client";

export interface RecordLeadOptions {
  propertyId: string;
  type: "phone" | "telegram" | "inquiry";
  propertyTitle?: string;
  propertySlug?: string;
  realtorId?: string;
  clientName?: string;
  clientPhone?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export function detectDevice(): string {
  if (typeof window === "undefined" || !navigator) return "Desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  return "Desktop";
}

export function detectTrafficSource(): string {
  if (typeof window === "undefined" || !document) return "Direct";
  const ref = document.referrer || "";
  if (!ref) return "Direct";
  if (ref.includes("t.me") || ref.includes("telegram")) return "Telegram";
  if (ref.includes("instagram.com")) return "Instagram";
  if (ref.includes("google.com")) return "Google";
  if (ref.includes("yandex")) return "Yandex";
  return "Referral";
}

/**
 * Non-blocking public lead recorder.
 * Dispatches asynchronously via sendBeacon or keepalive fetch so the user's
 * phone call or Telegram app navigation is NEVER blocked or delayed.
 */
export function recordPublicLead(options: RecordLeadOptions): void {
  try {
    if (typeof window === "undefined") return;

    const payload = {
      property_id: options.propertyId,
      type: options.type,
      property_title: options.propertyTitle,
      property_slug: options.propertySlug,
      realtor_id: options.realtorId,
      client_name: options.clientName,
      client_phone: options.clientPhone,
      message: options.message,
      device: detectDevice(),
      traffic_source: detectTrafficSource(),
      metadata: options.metadata || {},
    };

    const jsonStr = JSON.stringify(payload);

    // Try navigator.sendBeacon first (best for background dispatch on navigation)
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([jsonStr], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/leads", blob);
      if (sent) return;
    }

    // Fallback to fetch with keepalive: true, unawaited and non-blocking
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonStr,
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget: do not interrupt user experience if network fails
    });
  } catch {
    // Non-blocking catch
  }
}
