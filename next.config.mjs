/** @type {import('next').NextConfig} */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  worker-src 'self' blob:;
  child-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://images.unsplash.com https://gemozzkmoogjxtdwvepz.supabase.co https://*.googleusercontent.com;
  connect-src 'self' https://gemozzkmoogjxtdwvepz.supabase.co wss://gemozzkmoogjxtdwvepz.supabase.co https://accounts.google.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://vitals.vercel-insights.com;
  font-src 'self' data:;
  frame-src 'self' https://accounts.google.com;
  object-src 'none';
  base-uri 'self';
`.replace(/\s{2,}/g, ' ').trim();

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
            key: "X-Frame-Options",
            value: "DENY",
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
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
