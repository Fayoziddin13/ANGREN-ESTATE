export const PRODUCTION_SITE_URL = "https://angrenestate.uz";

/**
 * Public HTTPS base URL used in canonical links, sitemap, robots.txt, Open Graph
 * and Telegram buttons.
 *
 * The env value (NEXT_PUBLIC_SITE_URL / SITE_URL) is used only if it is a real
 * public HTTPS origin; local or non-HTTPS values (e.g. a leftover
 * `http://localhost:3000`) fall back to the production domain so a misconfigured
 * environment can never publish localhost URLs to search engines.
 */
export function getPublicSiteUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();

  if (
    envUrl &&
    envUrl.startsWith("https://") &&
    !envUrl.includes("localhost") &&
    !envUrl.includes("127.0.0.1") &&
    !envUrl.includes("0.0.0.0")
  ) {
    return envUrl.replace(/\/+$/, "");
  }

  return PRODUCTION_SITE_URL;
}

/** Absolute public URL for a site path such as `/properties/abc`. */
export function absoluteUrl(path: string = "/"): string {
  const base = getPublicSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
