"use client";

import { CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import type { UiResult } from "@/lib/demo/store";
import type { Moderation, PaymentStatus, RefundStatus, StatusPhase } from "@/lib/demo/engine";

export type Tone = "amber" | "sky" | "emerald" | "rose" | "orange" | "slate" | "violet" | "indigo";

const TONES: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export function Pill({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const MODERATION_UI: Record<Moderation, { label: string; tone: Tone }> = {
  not_submitted: { label: "Moderatsiyaga yuborilmagan", tone: "slate" },
  pending: { label: "Moderatsiyada", tone: "sky" },
  approved: { label: "Tasdiqlandi — saytda", tone: "emerald" },
  rejected: { label: "Rad etildi", tone: "rose" },
  revision: { label: "Tuzatish so‘raldi", tone: "orange" },
};

export const PAYMENT_UI: Record<PaymentStatus | "free", { label: string; tone: Tone }> = {
  free: { label: "Bepul", tone: "emerald" },
  awaiting_payment: { label: "To‘lov kutilmoqda", tone: "amber" },
  receipt_submitted: { label: "Chek yuborildi", tone: "sky" },
  under_review: { label: "Admin tekshirmoqda", tone: "indigo" },
  paid: { label: "To‘langan (admin tasdiqladi)", tone: "emerald" },
  rejected: { label: "To‘lov rad etildi", tone: "rose" },
  cancelled: { label: "Buyurtma bekor qilingan", tone: "slate" },
  refund_requested: { label: "Pul qaytarish so‘raldi", tone: "orange" },
  refunded: { label: "Pul qaytarilgani qayd etildi", tone: "violet" },
};

export const REFUND_UI: Record<Exclude<RefundStatus, "none">, { label: string; tone: Tone }> = {
  requested: { label: "Pul qaytarish kutilmoqda", tone: "amber" },
  refunded: { label: "Pul qaytarildi (DEMO)", tone: "violet" },
  declined: { label: "Qaytarish rad etildi", tone: "rose" },
};

export const STATUS_PHASE_UI: Record<StatusPhase, { label: string; tone: Tone }> = {
  awaiting_payment: { label: "To‘lov kutilmoqda", tone: "amber" },
  pending_approval: { label: "Admin tasdig‘ida (hali faol emas)", tone: "sky" },
  active: { label: "Faol", tone: "emerald" },
  expired: { label: "Muddati tugagan", tone: "slate" },
  rejected: { label: "Rad etildi", tone: "rose" },
  cancelled: { label: "Bekor qilingan", tone: "slate" },
};

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ResultBanner({ result, onClose }: { result: UiResult | null; onClose: () => void }) {
  if (!result) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      key={result.at}
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold animate-in fade-in slide-in-from-top-1 duration-200 ${
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <p className="flex-1 leading-snug">{result.message}</p>
      <button type="button" onClick={onClose} aria-label="Yopish" className="rounded-full p-0.5 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-brand-border bg-white p-4 sm:p-5 shadow-2xs ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-black text-brand-text">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs text-brand-muted">{hint}</p> : null}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-brand-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> Demo yuklanmoqda…
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-text outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";
export const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-brand-muted";
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-white px-3.5 py-2 text-sm font-bold text-brand-text transition hover:bg-brand-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-brand-border bg-brand-canvas px-3.5 py-3">
      <span>
        <span className="block text-sm font-bold text-brand-text">{label}</span>
        {hint ? <span className="block text-xs text-brand-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-primary" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/** Local date-time input value (yyyy-MM-ddTHH:mm) <-> ISO. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v: string): string {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}
