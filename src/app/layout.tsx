import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { LanguageProvider } from "@/context/LanguageContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { TelegramProvider } from "@/context/TelegramContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { GlobalModals } from "@/components/common/GlobalModals";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://angrenestate.uz"),
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
    url: "https://angrenestate.uz",
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
  alternates: {
    canonical: "https://angrenestate.uz",
    languages: {
      uz: "https://angrenestate.uz",
      ru: "https://angrenestate.uz",
    },
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
        <LanguageProvider>
          <CurrencyProvider>
            <AuthProvider>
              <TelegramProvider>
                {children}
                <AuthModal />
                <GlobalModals />
              </TelegramProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
