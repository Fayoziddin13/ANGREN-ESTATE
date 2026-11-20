import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { LanguageProvider } from "@/context/LanguageContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { TelegramProvider } from "@/context/TelegramContext";
import { TelegramMiniAppGuard } from "@/components/telegram/TelegramMiniAppGuard";
import { AuthModal } from "@/components/auth/AuthModal";
import { GlobalModals } from "@/components/common/GlobalModals";
import { getPublicSiteUrl } from "@/lib/siteUrl";
import { MotionProvider } from "@/components/common/MotionProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Defaults only. Indexable routes set their own canonical/Open Graph via
// buildPageMetadata(); nothing URL-specific may live here, because every page
// that lacks its own value would inherit it.
export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: "ANGREN ESTATE — Angren ko‘chmas mulki yagona xaritada",
  description: "Angren shahrining eng yaxshi kvartira, hovli va tijorat binolari. Sotuv va ijara.",
  keywords: ["angren ko‘chmas mulk", "kvartira", "hovli", "ijara", "sotuv", "angren estate"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "ANGREN ESTATE — Angren ko‘chmas mulki yagona xaritada",
    description: "Angren shahrining eng yaxshi kvartira, hovli va tijorat binolari. Sotuv va ijara.",
    siteName: "ANGREN ESTATE",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
        alt: "ANGREN ESTATE",
      },
    ],
    locale: "uz_UZ",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased selection:bg-brand-light selection:text-brand-dark">
        <MotionProvider>
        <LanguageProvider>
          <CurrencyProvider>
            <AuthProvider>
              <TelegramProvider>
                <TelegramMiniAppGuard>
                  {children}
                  <AuthModal />
                  <GlobalModals />
                </TelegramMiniAppGuard>
              </TelegramProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LanguageProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
