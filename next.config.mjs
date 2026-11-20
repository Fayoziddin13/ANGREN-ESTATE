/** @type {import('next').NextConfig} */

// Telegram Web (web.telegram.org) opens Mini Apps inside an iframe, so public pages
// must allow being framed by Telegram. The admin panel must never be framed.
const TELEGRAM_FRAME_ANCESTORS = "'self' https://web.telegram.org https://*.telegram.org";

const buildCsp = (frameAncestors) => `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net;
  worker-src 'self' blob:;
  child-src 'self' blob: https://*.yandex.ru https://*.yastatic.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://images.unsplash.com https://gemozzkmoogjxtdwvepz.supabase.co https://*.googleusercontent.com https://t.me https://*.telegram.org;
  connect-src 'self' https://api-maps.yandex.ru https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net https://gemozzkmoogjxtdwvepz.supabase.co wss://gemozzkmoogjxtdwvepz.supabase.co https://accounts.google.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://vitals.vercel-insights.com;
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

export default nextConfig;
