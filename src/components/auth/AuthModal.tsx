"use client";

import React from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTelegram } from "@/context/TelegramContext";

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, handleGoogleLogin, handleTelegramLogin, loading } = useAuth();
  const { isTelegram, initData } = useTelegram();
  const { t } = useLanguage();

  return (
    <Modal isOpen={isAuthModalOpen} onClose={closeAuthModal}>
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Official Canonical Brand Logo */}
        <div className="flex h-14 w-[70px] items-center justify-center rounded-2xl shadow-sm bg-[#167d4f] p-2 shrink-0">
          <Image
            src="/logo-white.png"
            alt="ANGREN ESTATE"
            width={60}
            height={48}
            className="h-full w-full object-contain"
            priority
          />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight text-brand-dark">
            {t.auth.modalTitle}
          </h2>
          <p className="text-sm text-brand-muted leading-relaxed max-w-xs mx-auto">
            {t.auth.modalSubtitle}
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="w-full pt-3 pb-1 space-y-2.5">
          {/* Telegram Sign-in Option (When inside Telegram Mini App) */}
          {isTelegram && initData && (
            <button
              onClick={() => handleTelegramLogin(initData)}
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-[#167d4f] text-white px-5 py-3.5 text-sm font-semibold shadow-sm hover:bg-[#1b8d5a] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              <svg className="h-5 w-5 fill-white shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
              <span>{t.auth.telegramSignIn}</span>
            </button>
          )}

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border border-brand-border bg-white px-5 py-3.5 text-sm font-semibold text-brand-text shadow-subtle hover:border-brand-primary/40 hover:bg-brand-canvas active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {/* Google SVG Icon */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t.auth.googleSignIn}</span>
          </button>
        </div>

        {/* Public Visitor Notice */}
        <p className="text-xs text-brand-subtle">
          {t.auth.guestNotice}
        </p>
      </div>
    </Modal>
  );
}
