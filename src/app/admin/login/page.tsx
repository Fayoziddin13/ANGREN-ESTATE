"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Globe,
  CheckCircle2,
  KeyRound,
  Fingerprint,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function SearchParamWatcher({
  onError,
  onRedirectUrl,
  locale,
}: {
  onError: (msg: string) => void;
  onRedirectUrl: (url: string) => void;
  locale: string;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("error") === "unauthorized") {
      onError(
        locale === "uz"
          ? "Ushbu bo‘lim faqat tizim ma'murlari uchun. Iltimos, administrator hisobingizga kiring."
          : "Этот раздел доступен только администраторам. Пожалуйста, войдите в аккаунт."
      );
    }
    const from = searchParams.get("from");
    if (from) onRedirectUrl(from);
  }, [searchParams, locale, onError, onRedirectUrl]);
  return null;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { locale, setLocale } = useLanguage();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState("/admin");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Handle lockout countdown
  useEffect(() => {
    if (lockoutSec === null || lockoutSec <= 0) return;
    const timer = setInterval(() => {
      setLockoutSec((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSec]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSec) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.retryAfterSec) {
          setLockoutSec(data.retryAfterSec);
          setErrorMessage(
            locale === "uz"
              ? `Juda ko‘p noto‘g‘ri urinishlar! Xavfsizlik uchun tizim ${data.retryAfterSec} soniyaga bloklandi.`
              : `Слишком много попыток! Система заблокирована на ${data.retryAfterSec} сек.`
          );
        } else {
          setErrorMessage(
            locale === "uz"
              ? data.error || "Login yoki parol noto‘g‘ri kiritildi."
              : data.error || "Неверный логин или пароль."
          );
        }
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 500);
    } catch (err) {
      setErrorMessage(
        locale === "uz"
          ? "Tarmoq xatosi. Qaytadan urinib ko‘ring."
          : "Ошибка сети. Попробуйте еще раз."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#051716] via-[#0c2e1f] to-[#081e14] flex flex-col justify-between p-4 sm:p-8 text-white relative overflow-hidden">
      <React.Suspense fallback={null}>
        <SearchParamWatcher
          onError={setErrorMessage}
          onRedirectUrl={setRedirectUrl}
          locale={locale}
        />
      </React.Suspense>

      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#339e71]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Brand & Language */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full z-10">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-[50px] shrink-0">
            <Image src="/logo-white.png" alt="ANGREN ESTATE" fill className="object-contain" priority />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#339e71] uppercase tracking-wider">
              Admin Control Center
            </div>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setLocale("uz")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              locale === "uz" ? "bg-white/20 text-white" : "text-[#e5f0eb]/70 hover:text-white"
            }`}
          >
            UZ
          </button>
          <button
            onClick={() => setLocale("ru")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              locale === "ru" ? "bg-white/20 text-white" : "text-[#e5f0eb]/70 hover:text-white"
            }`}
          >
            RU
          </button>
        </div>
      </div>

      {/* Center: Login Card */}
      <div className="max-w-md w-full mx-auto my-8 z-10">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#339e71]/20 text-[#339e71] border border-[#339e71]/30 mb-1">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {locale === "uz" ? "Boshqaruv tizimiga kirish" : "Панель администратора"}
            </h1>
            <p className="text-xs text-[#e5f0eb]/70">
              {locale === "uz"
                ? "Faqat vakolatli administratorlar uchun maxsus autentifikatsiya"
                : "Вход только для авторизованных администраторов"}
            </p>
          </div>

          {/* Error / Lockout Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {lockoutSec !== null && lockoutSec > 0 && (
                  <div className="font-bold text-red-300 mt-1">
                    {locale === "uz"
                      ? `Qayta urinish: ${lockoutSec} soniya`
                      : `Повтор через: ${lockoutSec} сек.`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3.5 rounded-2xl bg-[#339e71]/20 border border-[#339e71]/30 text-[#e5f0eb] text-xs flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-[#339e71] shrink-0" />
              <span>{locale === "uz" ? "Kirish tasdiqlandi. Yuklanmoqda..." : "Успешный вход. Загрузка..."}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/90">
                {locale === "uz" ? "Administrator logini yoki Email" : "Логин или Email администратора"}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#339e71]/70" />
                <input
                  type="text"
                  required
                  autoFocus
                  disabled={isLoading || Boolean(lockoutSec)}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@angrenestate.uz"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/25 border border-white/15 text-white placeholder:text-white/30 text-xs focus:outline-none focus:ring-2 focus:ring-[#339e71] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/90">
                {locale === "uz" ? "Maxfiy parol" : "Пароль"}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#339e71]/70" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={isLoading || Boolean(lockoutSec)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-2xl bg-black/25 border border-white/15 text-white placeholder:text-white/30 text-xs focus:outline-none focus:ring-2 focus:ring-[#339e71] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#339e71]/70 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & 2FA Indicator */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 text-[#e5f0eb]/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded bg-black/30 border-white/20 text-[#19573c] focus:ring-[#339e71] focus:ring-offset-0"
                />
                <span>{locale === "uz" ? "Eslab qolish (30 kun)" : "Запомнить меня (30 дней)"}</span>
              </label>

              <div className="inline-flex items-center gap-1 text-[11px] text-[#339e71]/80" title="2FA Ready">
                <Fingerprint className="h-3.5 w-3.5" />
                <span>2FA Ready</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || Boolean(lockoutSec) || isSuccess}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#19573c] to-[#0c2e1f] hover:from-[#206e4d] hover:to-[#19573c] text-white font-extrabold text-xs shadow-lg shadow-black/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{locale === "uz" ? "Tekshirilmoqda..." : "Проверка..."}</span>
                </>
              ) : (
                <>
                  <span>{locale === "uz" ? "Tizimga kirish" : "Войти в панель"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Features Badge */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-4 text-[11px] text-[#339e71]/80">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#339e71]" />
              Server-side RBAC
            </span>
            <span>•</span>
            <span>Rate-limited</span>
            <span>•</span>
            <span>HttpOnly Session</span>
          </div>
        </div>
      </div>

      {/* Bottom: Back to Public Website */}
      <div className="text-center z-10">
        <Link
          href="/"
          className="text-xs text-[#e5f0eb]/70 hover:text-white transition-colors inline-flex items-center gap-1.5"
        >
          <span>← {locale === "uz" ? "Bosh sahifaga qaytish" : "Вернуться на главную"}</span>
        </Link>
      </div>
    </div>
  );
}
