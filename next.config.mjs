import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// Telegram Web (web.telegram.org) opens Mini Apps inside an iframe, so public pages
// must allow being framed by Telegram. The admin panel must never be framed.
const TELEGRAM_FRAME_ANCESTORS = "'self' https://web.telegram.org https://*.telegram.org";

// Supabase hosts allowed by the CSP. The production project is always allowed (stored
// image URLs point at it); a different project from NEXT_PUBLIC_SUPABASE_URL (e.g. a
// local test project) is added on top, so production output is unchanged.
const PRODUCTION_SUPABASE_REF = "gemozzkmoogjxtdwvepz";
const PRODUCTION_SUPABASE_HOST = `${PRODUCTION_SUPABASE_REF}.supabase.co`;
const supabaseHosts = (() => {
  const hosts = [PRODUCTION_SUPABASE_HOST];
  try {
    const envHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host;
    if (envHost && envHost.endsWith(".supabase.co") && !hosts.includes(envHost)) hosts.push(envHost);
  } catch {}
  return hosts;
})();
const SUPABASE_HTTPS = supabaseHosts.map((h) => `https://${h}`).join(" ");
const SUPABASE_WSS = supabaseHosts.map((h) => `wss://${h}`).join(" ");

const buildCsp = (frameAncestors) => `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net;
  worker-src 'self' blob:;
  child-src 'self' blob: https://*.yandex.ru https://*.yastatic.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://images.unsplash.com ${SUPABASE_HTTPS} https://*.googleusercontent.com https://t.me https://*.telegram.org;
  connect-src 'self' https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net ${SUPABASE_HTTPS} ${SUPABASE_WSS} https://accounts.google.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://vitals.vercel-insights.com;
  font-src 'self' data:;
  frame-src 'self' https://accounts.google.com https://*.yandex.ru https://*.yastatic.net;
  frame-ancestors ${frameAncestors};
  object-src 'none';
  base-uri 'self';
`.replace(/\s{2,}/g, ' ').trim();

const adminFrameHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: buildCsp("'none'") },
];

// `next dev` must not run against the production database: the server uses the
// service-role key, so clicking around locally would write to live data. Put the test
// project keys in .env.development.local (see .env.test.example), or set
// ALLOW_PRODUCTION_DB_IN_DEV=1 to connect to production on purpose.
// Builds and the production server (Vercel) are never affected.
function assertDevServerDatabase(phase, env) {
  if (phase !== PHASE_DEVELOPMENT_SERVER || env.ALLOW_PRODUCTION_DB_IN_DEV === "1") return;
  const usesProduction = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL"].some((key) =>
    (env[key] || "").toLowerCase().includes(PRODUCTION_SUPABASE_REF)
  );
  if (usesProduction) {
    throw new Error(
      `[safety] next dev is configured for the PRODUCTION Supabase project (${PRODUCTION_SUPABASE_REF}). ` +
        "Put the test project keys in .env.development.local (see .env.test.example), " +
        "or set ALLOW_PRODUCTION_DB_IN_DEV=1 if you really mean to use live data."
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: buildCsp(TELEGRAM_FRAME_ANCESTORS),
          },
        ],
      },
      // Later entries override earlier ones for the same header key.
      { source: "/admin", headers: adminFrameHeaders },
      { source: "/admin/:path*", headers: adminFrameHeaders },
    ];
  },
};

export default function config(phase) {
  assertDevServerDatabase(phase, process.env);
  return nextConfig;
}
