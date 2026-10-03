"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTelegram } from "@/context/TelegramContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Lock, Phone, RefreshCw, Sparkles, Building2 } from "lucide-react";

interface TelegramMiniAppGuardProps {
  children: React.ReactNode;
}

export function TelegramMiniAppGuard({ children }: TelegramMiniAppGuardProps) {
  const pathname = usePathname();
  const { isTelegram, isReady, initData, closeApp, openTelegramLink } = useTelegram();
  const { locale } = useLanguage();
  const { handleTelegramLogin } = useAuth();

  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | "denied">("checking");
  const [denialReason, setDenialReason] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Admin routes should never be blocked by Telegram Mini App user registration
  const isAdminRoute = pathname?.startsWith("/admin");

  const checkAccess = useCallback(async () => {
    if (!isTelegram || !initData || isAdminRoute) {
      setAccessStatus("granted");
      return;
    }

    try {
      setIsRetrying(true);
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.access_granted && data.is_registered) {
        setAccessStatus("granted");
        // Also sync profile in AuthContext
        if (handleTelegramLogin) {
          handleTelegramLogin(initData).catch(() => {});
        }
      } else {
        setAccessStatus("denied");
        setDenialReason(data.message || (locale === "uz" ? "Avval Telegram bot orqali ro‘yxatdan o‘ting." : "Сначала пройдите регистрацию через Telegram-бота."));
      }
    } catch (err) {
      console.error("[TelegramMiniAppGuard] Access check error:", err);
      setAccessStatus("denied");
    } finally {
      setIsRetrying(false);
    }
  }, [isTelegram, initData, isAdminRoute, locale, handleTelegramLogin]);

  useEffect(() => {
    if (!isReady) return;

    if (!isTelegram || isAdminRoute) {
      setAccessStatus("granted");
      return;
    }

    checkAccess();
  }, [isReady, isTelegram, isAdminRoute, checkAccess]);

  // If outside Telegram or admin route or access granted, render regular app
  if (isAdminRoute || !isTelegram || accessStatus === "granted") {
    return <>{children}</>;
  }

  // Loading / Checking state
  if (accessStatus === "checking") {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#fbfcfb] p-6 text-center">
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-2xl bg-[#167d4f] text-white flex items-center justify-center shadow-lg shadow-emerald-900/20 animate-pulse">
            <Building2 className="h-8 w-8" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white">
            <Sparkles className="h-3 w-3" />
          </div>
        </div>

        <h1 className="text-lg font-black text-slate-900 tracking-tight mb-2">
          ANGREN ESTATE
        </h1>
        <p className="text-xs text-slate-500 font-medium animate-pulse">
          {locale === "uz" ? "Xavfsizlik va ro‘yxatdan o‘tish holati tekshirilmoqda..." : "Проверка безопасности и статуса регистрации..."}
        </p>

        <div className="mt-6 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-[#167d4f] rounded-full animate-[progress_1s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // Access Denied State (User is in Telegram Mini App but has NOT completed contact registration)
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#fbfcfb] p-6 text-center select-none overflow-y-auto">
      <div className="w-full max-w-sm mx-auto my-auto flex flex-col items-center py-6">
        {/* Brand Icon Badge */}
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-3xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-[#167d4f] shadow-sm">
            <Lock className="h-10 w-10 text-[#167d4f]" />
          </div>
          <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
          {locale === "uz" ? "Ro‘yxatdan o‘tish talab qilinadi" : "Требуется регистрация"}
        </h2>
        <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6">
          {locale === "uz"
            ? "ANGREN ESTATE Mini App'dan foydalanish uchun avval rasmiy botimizda telefon raqamingizni yuborib ro‘yxatdan o‘ting."
            : "Для доступа к Mini App ANGREN ESTATE сначала пройдите быструю регистрацию в Telegram-боте, поделившись номером телефона."}
        </p>

        {/* Informative Step Box */}
        <div className="w-full p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs mb-6 text-left space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-[#eaf5f0] text-[#167d4f] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span className="text-xs text-slate-700 font-medium">
              {locale === "uz" ? "Pastdagi tugma orqali botga o‘ting" : "Перейдите в бота по кнопке ниже"}
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-[#eaf5f0] text-[#167d4f] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span className="text-xs text-slate-700 font-medium">
              {locale === "uz" ? "«📱 Telefon raqamimni yuborish» tugmasini bosing" : "Нажмите «📱 Отправить номер телефона»"}
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="h-5 w-5 rounded-full bg-[#eaf5f0] text-[#167d4f] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span className="text-xs text-slate-700 font-medium">
              {locale === "uz" ? "Mini App'ga to‘liq kirish huquqiga ega bo‘ling" : "Получите полный доступ ко всем объектам"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5">
          {/* Main Action: Go to Bot / Register */}
          <button
            type="button"
            onClick={() => {
              if (typeof closeApp === "function") {
                closeApp();
              } else if (typeof openTelegramLink === "function") {
                openTelegramLink("https://t.me/angrenestate_bot?start=register");
              } else {
                window.location.href = "https://t.me/angrenestate_bot?start=register";
              }
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-[#167d4f] hover:bg-[#145d3c] active:scale-98 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all"
          >
            <Phone className="h-4 w-4 stroke-[2.5]" />
            <span>{locale === "uz" ? "Botda ro‘yxatdan o‘tish" : "Пройти регистрацию в боте"}</span>
          </button>

          {/* Secondary Action: Recheck */}
          <button
            type="button"
            disabled={isRetrying}
            onClick={checkAccess}
            className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRetrying ? "animate-spin" : ""}`} />
            <span>
              {isRetrying
                ? (locale === "uz" ? "Tekshirilmoqda..." : "Проверка...")
                : (locale === "uz" ? "Ro‘yxatdan o‘tdim (Qayta tekshirish)" : "Я зарегистрировался (Проверить)")}
            </span>
          </button>
        </div>
      </div>

      {/* Security Brand Footer */}
      <div className="pt-4 text-center">
        <p className="text-[10px] text-slate-400 font-medium">
          ANGREN ESTATE • {locale === "uz" ? "Xavfsiz va tekshirilgan ko‘chmas mulk" : "Безопасная недвижимость"}
        </p>
      </div>
    </div>
  );
}
