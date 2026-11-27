"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CreditCard, FlaskConical, CheckCircle2, XCircle, Ban, Loader2 } from "lucide-react";
import { formatDate, formatSum, ORDER_LABELS, STICKER_LABELS, StatusPill, newIdempotencyKey } from "@/lib/monetization/client";

interface Props {
  orderId: string;
  amount: number;
  signature: string;
  signatureOk: boolean;
  service: string;
  status: string;
  base: number;
  discount: number;
  finalAmount: number;
  expiresAt: string;
  plan: any;
}

const RESULT_TEXT: Record<string, string> = {
  paid: "To‘lov qabul qilindi. Ariza / stiker admin ko‘rigiga yuborildi.",
  duplicate: "Bu to‘lov allaqachon hisobga olingan (takroriy so‘rov).",
  not_pending: "Buyurtma to‘lov kutmayapti (allaqachon to‘langan yoki bekor qilingan).",
  expired: "To‘lov muddati tugagan. “Mening e'lonlarim”dan qayta to‘lang.",
  amount_mismatch: "Summa buyurtmaga mos emas — to‘lov rad etildi.",
  failed: "To‘lov o‘tmadi deb belgilandi.",
  cancelled: "To‘lov bekor qilindi.",
  unknown_order: "Buyurtma topilmadi.",
};

export function MockPayClient(props: Props) {
  const attempt = useRef(newIdempotencyKey());
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(outcome: "success" | "fail" | "cancel") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch("/api/payments/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: props.orderId,
          amount: props.amount,
          sig: props.signature,
          outcome,
          attempt_id: attempt.current,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message?.uz || json.error || "error");
      setResult(json.result);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  const what =
    props.service === "listing"
      ? "E'lon joylashtirish"
      : `Stiker: ${STICKER_LABELS[props.plan?.sticker_type]?.uz || props.plan?.sticker_type} · ${props.plan?.duration_days} kun`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-amber-400 text-amber-950 px-5 py-2.5 text-xs font-black flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> TEST TO‘LOV (Mock) — haqiqiy pul yechilmaydi
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#167d4f] text-white flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">ANGREN ESTATE</p>
              <p className="font-black text-slate-900">{what}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-1">
            <div className="flex justify-between"><span>Narx</span><span>{formatSum(props.base)}</span></div>
            {props.discount > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Chegirma</span><span>−{formatSum(props.discount)}</span></div>
            )}
            <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>To‘lov</span><span data-testid="mock-amount">{formatSum(props.amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 pt-1">
              <span>Holat</span><StatusPill label={ORDER_LABELS[props.status]} locale="uz" />
            </div>
            <div className="flex justify-between text-xs text-slate-500"><span>Muddati</span><span>{formatDate(props.expiresAt)}</span></div>
          </div>

          {!props.signatureOk && (
            <p className="text-xs text-rose-600">Havola imzosi noto‘g‘ri — server bu to‘lovni qabul qilmaydi.</p>
          )}

          {result ? (
            <div className="space-y-3 text-center">
              {result === "paid" ? <CheckCircle2 className="h-10 w-10 text-[#167d4f] mx-auto" /> : <XCircle className="h-10 w-10 text-rose-500 mx-auto" />}
              <p className="text-sm font-bold text-slate-800" data-testid="mock-result">{RESULT_TEXT[result] || result}</p>
              <Link href="/kabinet" className="inline-flex px-4 py-2.5 rounded-2xl bg-[#167d4f] text-white text-xs font-bold">
                Mening e'lonlarimga qaytish
              </Link>
            </div>
          ) : (
            <div className="grid gap-2">
              <button data-testid="mock-pay-success" onClick={() => send("success")} disabled={busy !== null}
                className="rounded-2xl bg-[#167d4f] text-white py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                {busy === "success" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} To‘lash (muvaffaqiyatli)
              </button>
              <button data-testid="mock-pay-fail" onClick={() => send("fail")} disabled={busy !== null}
                className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                <XCircle className="h-4 w-4" /> To‘lov o‘tmadi (xato)
              </button>
              <button data-testid="mock-pay-cancel" onClick={() => send("cancel")} disabled={busy !== null}
                className="rounded-2xl border border-slate-200 text-slate-600 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                <Ban className="h-4 w-4" /> Bekor qilish
              </button>
            </div>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
