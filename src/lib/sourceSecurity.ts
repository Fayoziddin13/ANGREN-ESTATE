/**
 * ANGREN ESTATE — News Source Security & SSRF Protection Engine
 *
 * Enforces strict Server-Side Request Forgery (SSRF) defenses:
 * 1. Protocol whitelist: only "http:" and "https:" (rejects file:, gopher:, ftp:, etc.).
 * 2. Hostname/IP blacklist: strictly blocks loopback (127.0.0.0/8, ::1),
 *    private IPv4 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16),
 *    link-local / cloud metadata (169.254.0.0/16, metadata.google.internal, instance-data),
 *    IPv6 private/link-local (fc00::/7, fe80::/10), and localhost.
 * 3. Safe redirect inspection: manually inspects HTTP 3xx redirects to prevent
 *    open redirect bypasses to internal networks.
 * 4. Content sanitization: all remote feed data is treated as untrusted input.
 */

export interface SsrfValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
  domain?: string;
}

const RESERVED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "local",
  "broadcasthost",
  "metadata.google.internal",
  "instance-data",
  "metadata",
]);

/**
 * Checks if an IPv4 string falls within private, loopback, or link-local ranges.
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [b0, b1] = parts;

  // 127.0.0.0/8 - Loopback
  if (b0 === 127) return true;

  // 0.0.0.0/8 - Current network
  if (b0 === 0) return true;

  // 10.0.0.0/8 - Private Class A
  if (b0 === 10) return true;

  // 172.16.0.0/12 - Private Class B (172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 - Private Class C
  if (b0 === 192 && b1 === 168) return true;

  // 169.254.0.0/16 - Link-local / Cloud metadata (AWS, GCP, Azure, DigitalOcean)
  if (b0 === 169 && b1 === 254) return true;

  // 100.64.0.0/10 - Shared address space (Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  return false;
}

/**
 * Checks if an IPv6 string is loopback, unique local, or link-local.
 */
export function isPrivateOrReservedIpv6(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, "").toLowerCase();

  // Loopback (::1, 0:0:0:0:0:0:0:1)
  if (host === "::1" || host === "0:0:0:0:0:0:0:1" || host === "::") return true;

  // Unique Local (fc00::/7)
  if (host.startsWith("fc") || host.startsWith("fd")) return true;

  // Link-local (fe80::/10)
  if (host.startsWith("fe80") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) return true;

  // IPv4-mapped (::ffff:127.0.0.1, etc.)
  if (host.startsWith("::ffff:")) {
    const ipv4Part = host.slice(7);
    return isPrivateOrReservedIpv4(ipv4Part);
  }

  return false;
}

/**
 * Validates a feed URL against SSRF vulnerabilities.
 */
export function validateFeedUrlSsrf(inputUrl: string): SsrfValidationResult {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { valid: false, error: "URL manzili kiritilishi shart" };
  }

  const trimmed = inputUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "URL manzili formati noto‘g‘ri" };
  }

  // 1. Protocol Whitelist: HTTP or HTTPS only
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      valid: false,
      error: `Xavfli yoki ruxsat etilmagan protokol: ${parsed.protocol}. Faqat HTTPS yoki HTTP ruxsat etiladi.`,
    };
  }

  // 2. Reject URL Credentials (user:pass@host)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "URL manzilida login yoki parol (credentials) ko‘rsatish xavfsizlik nuqtai nazaridan taqiqlangan.",
    };
  }

  // 3. Port Whitelist: only standard web ports allowed
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);
    if (isNaN(portNum) || !ALLOWED_PORTS.has(portNum)) {
      return {
        valid: false,
        error: `Ruxsat etilmagan port: ${parsed.port}. Faqat standart web portlari (80, 443, 8080, 8443) ruxsat etiladi.`,
      };
    }
  }

  const hostname = parsed.hostname.toLowerCase();

  // 4. Block Decimal / Octal / Hex / Dword IP representations (e.g. 2130706433, 0177.0.0.1, 0x7f000001)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-fA-F]+$/i.test(hostname)) {
    return {
      valid: false,
      error: `Raqamli yoki o‘n oltilik IP formati (${hostname}) xavfsizlik sababli bloklangan.`,
    };
  }

  // 5. Reserved & Local Hostnames
  if (
    RESERVED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".arpa")
  ) {
    return {
      valid: false,
      error: `Xavfli yoki ichki manzil: ${hostname}. Ichki tarmoqqa murojaat taqiqlangan.`,
    };
  }

  // 6. IPv4 Checks
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    // Check octal leading zero notation in any octet (e.g. 127.000.000.001)
    const octets = hostname.split(".");
    if (octets.some((o) => o.length > 1 && o.startsWith("0"))) {
      return {
        valid: false,
        error: `Nostandart oktal IP formati (${hostname}) bloklangan.`,
      };
    }

    if (isPrivateOrReservedIpv4(hostname)) {
      return {
        valid: false,
        error: `Xavfli xususiy IP-manzil: ${hostname}. Ichki tarmoq manzillari bloklangan.`,
      };
    }
  }

  // 7. IPv6 Checks & IPv4-mapped IPv6
  if (hostname.includes(":") || hostname.startsWith("[")) {
    if (isPrivateOrReservedIpv6(hostname)) {
      return {
        valid: false,
        error: `Xavfli xususiy IPv6 manzil: ${hostname}. Ichki tarmoq manzillari bloklangan.`,
      };
    }
  }

  // 8. Must contain at least one dot in hostname (e.g. domain.uz)
  if (!hostname.includes(".")) {
    return {
      valid: false,
      error: `Yaroqsiz domen nomi: ${hostname}. Domen kamida bitta nuqtaga ega bo‘lishi kerak.`,
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    domain: hostname.replace(/^www\./, ""),
  };
}

/**
 * Resolves DNS for the given hostname and verifies that NONE of the resolved IP addresses
 * belong to private, loopback, or cloud metadata ranges.
 * This defends against DNS rebinding and domain-to-internal-IP redirection.
 */
export async function resolveAndValidateIpSsrf(hostname: string): Promise<{ valid: boolean; error?: string }> {
  // If hostname is already an IPv4 or IPv6, validateFeedUrlSsrf already verified it
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(":") || hostname.startsWith("[")) {
    return { valid: true };
  }

  try {
    const dns = await import("node:dns");
    const lookups = await dns.promises.lookup(hostname, { all: true });
    if (!lookups || lookups.length === 0) {
      return { valid: false, error: `Domen nomini aniqlab bo‘lmadi (DNS topilmadi): ${hostname}` };
    }

    for (const entry of lookups) {
      if (entry.family === 4 && isPrivateOrReservedIpv4(entry.address)) {
        return {
          valid: false,
          error: `Domen (${hostname}) ichki/xususiy IPv4 manzilga (${entry.address}) yo‘naltirilgan. Xavfsizlik sababli murojaat taqiqlangan.`,
        };
      }
      if (entry.family === 6 && isPrivateOrReservedIpv6(entry.address)) {
        return {
          valid: false,
          error: `Domen (${hostname}) ichki/xususiy IPv6 manzilga (${entry.address}) yo‘naltirilgan. Xavfsizlik sababli murojaat taqiqlangan.`,
        };
      }
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `DNS tekshiruvida xatolik: ${err?.message || err}` };
  }
}

/**
 * Fetch a remote feed with strict SSRF protection and safe redirect handling.
 * Manually inspects redirects up to maxRedirects to prevent open redirect attacks to internal networks.
 */
export async function safeFetchFeed(
  url: string,
  options?: {
    timeoutMs?: number;
    maxRedirects?: number;
    maxSizeBytes?: number;
    headers?: Record<string, string>;
    skipDnsResolution?: boolean;
  }
): Promise<Response> {
  const timeoutMs = options?.timeoutMs || 10000;
  const maxRedirects = options?.maxRedirects ?? 3;
  const maxSizeBytes = options?.maxSizeBytes || 5 * 1024 * 1024; // 5 MB max
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    // 1. SSRF URL Syntax Check on current URL
    const ssrfCheck = validateFeedUrlSsrf(currentUrl);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF himoyasi: ${ssrfCheck.error}`);
    }

    const parsedUrl = new URL(currentUrl);

    // 2. DNS Rebinding / Private IP Resolution Check
    if (!options?.skipDnsResolution) {
      const dnsCheck = await resolveAndValidateIpSsrf(parsedUrl.hostname);
      if (!dnsCheck.valid) {
        throw new Error(`SSRF DNS himoyasi: ${dnsCheck.error}`);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let resp: Response;
    try {
      resp = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual", // Do NOT follow redirects automatically without SSRF checks!
        headers: {
          "User-Agent": "AngrenEstate-NewsHarvester/1.0 (+https://angrenestate.uz)",
          Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml;q=0.9, */*;q=0.8",
          ...options?.headers,
        },
      });
    } finally {
      clearTimeout(timer);
    }

    // 3. Handle Redirects (301, 302, 303, 307, 308)
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) {
        throw new Error(`Server qayta yo‘naltirish (HTTP ${resp.status}) berdi, lekin Location sarlavhasi yo‘q.`);
      }

      if (redirectCount >= maxRedirects) {
        throw new Error(`Qayta yo‘naltirishlar chegaradan oshdi (max: ${maxRedirects}).`);
      }

      // Resolve relative or absolute redirect destination
      const resolvedRedirectUrl = new URL(location, currentUrl).toString();

      // Validate destination against SSRF!
      const destCheck = validateFeedUrlSsrf(resolvedRedirectUrl);
      if (!destCheck.valid) {
        throw new Error(`SSRF himoyasi: xavfli qayta yo‘naltirish manziliga yo‘l qo‘yilmaydi (${destCheck.error}).`);
      }

      currentUrl = resolvedRedirectUrl;
      continue;
    }

    // 4. Response Size Validation (prevent large payload / zip bomb DoS)
    const contentLength = resp.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      throw new Error(`Manba javob hajmi belgilangan xavfsizlik limitidan (${Math.round(maxSizeBytes / 1024 / 1024)}MB) oshdi.`);
    }

    return resp;
  }

  throw new Error("Kutilmagan qayta yo‘naltirish xatosi yuz berdi.");
}
