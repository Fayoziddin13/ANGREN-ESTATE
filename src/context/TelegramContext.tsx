"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { TelegramUser } from "@/lib/telegramServer";
import { useLanguage } from "./LanguageContext";

interface BackButtonOptions {
  visible: boolean;
  onClick?: () => void;
}

interface HapticFeedback {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
}

interface TelegramContextType {
  isTelegram: boolean;
  isReady: boolean;
  platform: string;
  telegramUser: TelegramUser | null;
  initData: string;
  setBackButton: (options: BackButtonOptions) => void;
  haptic: HapticFeedback;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  closeApp: () => void;
}

const TelegramContext = createContext<TelegramContextType | undefined>(undefined);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { setLocale, locale } = useLanguage();
  const [isTelegram, setIsTelegram] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [platform, setPlatform] = useState<string>("browser");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState<string>("");

  const backButtonHandlerRef = useRef<(() => void) | undefined>(undefined);

  // Initialize Telegram WebApp SDK safely
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      setIsReady(true);
      return;
    }

    // Detect if running inside real Telegram client
    const hasInitData = Boolean(tg.initData && tg.initData.length > 0);
    const hasPlatform = tg.platform && tg.platform !== "unknown";

    if (hasInitData || hasPlatform) {
      setIsTelegram(true);
      setPlatform(tg.platform || "telegram");
      setInitData(tg.initData || "");

      // 1. Notify Telegram client that Web App is ready
      try {
        tg.ready();
      } catch (e) {}

      // 2. Expand to full viewport height
      try {
        tg.expand();
      } catch (e) {}

      // 3. Prevent accidental swipe-to-close on map interactions
      try {
        if (typeof tg.enableClosingConfirmation === "function") {
          tg.enableClosingConfirmation();
        }
      } catch (e) {}

      // 4. Set unified brand primary color for Telegram header
      try {
        if (typeof tg.setHeaderColor === "function") {
          tg.setHeaderColor("#167d4f");
        }
        if (typeof tg.setBackgroundColor === "function") {
          tg.setBackgroundColor("#fbfcfb");
        }
      } catch (e) {}

      // 5. Add .is-telegram class to HTML for safe-area CSS
      document.documentElement.classList.add("is-telegram");

      // 6. Parse user from initDataUnsafe if available
      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        setTelegramUser({
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          username: u.username,
          language_code: u.language_code,
          is_premium: u.is_premium,
          photo_url: u.photo_url,
        });

        // Sync initial locale from Telegram if no local preference exists
        try {
          const savedLocale = localStorage.getItem("angren_estate_lang");
          if (!savedLocale && u.language_code) {
            if (u.language_code.startsWith("uz")) {
              setLocale("uz");
            } else if (u.language_code.startsWith("ru")) {
              setLocale("ru");
            }
          }
        } catch (e) {}
      }
    }

    setIsReady(true);
  }, [setLocale]);

  // Dynamic BackButton Manager
  const setBackButton = useCallback(({ visible, onClick }: BackButtonOptions) => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    // Remove previous listener if exists
    if (backButtonHandlerRef.current) {
      tg.BackButton.offClick(backButtonHandlerRef.current);
      backButtonHandlerRef.current = undefined;
    }

    if (visible) {
      if (onClick) {
        backButtonHandlerRef.current = onClick;
        tg.BackButton.onClick(onClick);
      }
      tg.BackButton.show();
    } else {
      tg.BackButton.hide();
    }
  }, []);

  // Haptic feedback methods
  const haptic: HapticFeedback = {
    light: () => {
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
      } catch (e) {}
    },
    medium: () => {
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred("medium");
      } catch (e) {}
    },
    heavy: () => {
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred("heavy");
      } catch (e) {}
    },
    success: () => {
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      } catch (e) {}
    },
    warning: () => {
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred("warning");
      } catch (e) {}
    },
    error: () => {
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      } catch (e) {}
    },
  };

  const openTelegramLink = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && typeof tg.openTelegramLink === "function") {
      tg.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const openLink = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && typeof tg.openLink === "function") {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const closeApp = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && typeof tg.close === "function") {
      tg.close();
    }
  };

  return (
    <TelegramContext.Provider
      value={{
        isTelegram,
        isReady,
        platform,
        telegramUser,
        initData,
        setBackButton,
        haptic,
        openTelegramLink,
        openLink,
        closeApp,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error("useTelegram must be used within a TelegramProvider");
  }
  return context;
}
