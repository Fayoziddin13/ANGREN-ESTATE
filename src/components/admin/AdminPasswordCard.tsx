"use client";

import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const MIN_LENGTH = 12;

type Locale = "uz" | "ru";

const MESSAGES: Record<string, { uz: string; ru: string }> = {
  WRONG_CURRENT: { uz: "Joriy parol noto‘g‘ri.", ru: "Текущий пароль неверный." },
  TOO_SHORT: { uz: `Yangi parol kamida ${MIN_LENGTH} ta belgidan iborat bo‘lsin.`, ru: `Новый пароль должен быть не короче ${MIN_LENGTH} символов.` },
  TOO_LONG: { uz: "Yangi parol juda uzun (ko‘pi bilan 128 belgi).", ru: "Новый пароль слишком длинный (не более 128 символов)." },
  NEEDS_LETTERS_AND_DIGITS: { uz: "Parolda ham harf, ham raqam bo‘lsin.", ru: "Пароль должен содержать и буквы, и цифры." },
  SAME_AS_CURRENT: { uz: "Yangi parol joriy paroldan farq qilsin.", ru: "Новый пароль должен отличаться от текущего." },
  CONTAINS_IDENTITY: { uz: "Parolda login yoki e-mail bo‘lmasin.", ru: "Пароль не должен содержать логин или e-mail." },
  MISMATCH: { uz: "Yangi parol va tasdiqlash mos kelmadi.", ru: "Новый пароль и подтверждение не совпадают." },
  MISSING_FIELDS: { uz: "Barcha maydonlarni to‘ldiring.", ru: "Заполните все поля." },
  RATE_LIMITED: { uz: "Urinishlar juda ko‘p. 15 daqiqadan so‘ng qayta urinib ko‘ring.", ru: "Слишком много попыток. Повторите через 15 минут." },
  STORE_UNAVAILABLE: { uz: "Parol omboriga ulanib bo‘lmadi. Keyinroq urinib ko‘ring.", ru: "Хранилище паролей недоступно. Попробуйте позже." },
  UNAUTHORIZED: { uz: "Sessiya tugagan. Qayta kiring.", ru: "Сессия истекла. Войдите снова." },
  DEFAULT: { uz: "Parolni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.", ru: "Не удалось изменить пароль. Попробуйте ещё раз." },
};

function msg(code: string, locale: Locale) {
  return (MESSAGES[code] || MESSAGES.DEFAULT)[locale];
}

/** Client-side mirror of the server policy (the server re-checks everything). */
function localPolicyError(current: string, next: string, confirm: string): string | null {
  if (!current || !next || !confirm) return "MISSING_FIELDS";
  if (next.length < MIN_LENGTH) return "TOO_SHORT";
  if (next.length > 128) return "TOO_LONG";
  if (!/\p{L}/u.test(next) || !/\d/.test(next)) return "NEEDS_LETTERS_AND_DIGITS";
  if (next === current) return "SAME_AS_CURRENT";
  if (next !== confirm) return "MISMATCH";
  return null;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggle,
  toggleLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
  toggleLabel: string;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <label htmlFor={id} className="block text-xs font-bold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={256}
          className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-3 pr-10 text-sm text-slate-900 focus:outline-none focus:border-[#167d4f] focus:ring-2 focus:ring-[#167d4f]/20"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function AdminPasswordCard({ locale }: { locale: Locale }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const uz = locale === "uz";
  const toggleLabel = visible ? (uz ? "Parolni yashirish" : "Скрыть пароль") : (uz ? "Parolni ko‘rsatish" : "Показать пароль");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    const localError = localPolicyError(current, next, confirm);
    if (localError) {
      setError(msg(localError, locale));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(msg(String(data?.error || "DEFAULT"), locale));
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setVisible(false);
      setSuccess(true);
    } catch {
      setError(msg("DEFAULT", locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4" noValidate>
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#167d4f]" />
          {uz ? "Parolni o‘zgartirish" : "Изменить пароль"}
        </h2>
        <p className="text-xs text-slate-600 font-medium mt-1">
          {uz
            ? `Yangi parol serverda shifrlangan (PBKDF2) holda saqlanadi va shundan keyin faqat u ishlaydi. Kamida ${MIN_LENGTH} belgi, harf va raqam bo‘lsin.`
            : `Новый пароль хранится на сервере в виде хеша (PBKDF2), после смены работает только он. Минимум ${MIN_LENGTH} символов, буквы и цифры.`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PasswordField
          id="admin-current-password"
          label={uz ? "Joriy parol" : "Текущий пароль"}
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
          toggleLabel={toggleLabel}
        />
        <PasswordField
          id="admin-new-password"
          label={uz ? "Yangi parol" : "Новый пароль"}
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
          toggleLabel={toggleLabel}
        />
        <PasswordField
          id="admin-confirm-password"
          label={uz ? "Yangi parolni tasdiqlang" : "Подтвердите новый пароль"}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
          toggleLabel={toggleLabel}
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {uz
              ? "Parol o‘zgartirildi. Keyingi kirishda yangi paroldan foydalaning."
              : "Пароль изменён. При следующем входе используйте новый пароль."}
          </span>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {uz
            ? "Boshqa qurilmalardagi ochiq sessiyalar o‘z muddati tugaguncha amal qiladi."
            : "Открытые сессии на других устройствах действуют до истечения срока."}
        </p>
        <button
          type="submit"
          disabled={loading}
          className="lg-btn-primary inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#167d4f] px-5 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {uz ? "Parolni o‘zgartirish" : "Изменить пароль"}
        </button>
      </div>
    </form>
  );
}
