"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ShieldAlert, ArrowLeft, LogIn, CreditCard, Copy, Upload, FileText, Clock, Ban, AlertTriangle, Loader2 } from "lucide-react";
import { readReceiptFile, useDemo } from "@/lib/demo/store";
import {
  USER_PAYABLE, cancelOrder, currentUser, formatCard, formatSum, isPaidLike, submitReceipt, type Order, type PromoCode, type Quote,
} from "@/lib/demo/engine";
import { Card, Loading, MODERATION_UI, PAYMENT_UI, Pill, ResultBanner, btnDanger, btnPrimary, btnSecondary, fmtDate, inputCls, labelCls } from "@/components/demo/ui";
import { PriceBreakdown } from "@/components/demo/parts";
import { DemoBadge } from "@/components/demo/DemoShell";

function orderQuote(o: Order, promotionName: string | null, promotionPercent: number, promo: PromoCode | null): Quote {
  return {
    base: o.baseAmount,
    promotion: o.promotionId ? { id: o.promotionId, name: promotionName ?? "Aksiya", description: "", percent: promotionPercent, target: "all", startsAt: "", endsAt: "", active: true } : null,
    promotionDiscount: o.promotionDiscount,
    promo: o.promoCode ? promo ?? { id: "", code: o.promoCode, kind: "fixed", value: o.promoDiscount, target: "all", validFrom: "", validTo: "", usageLimit: 0, used: 0, active: true } : null,
    promoDiscount: o.promoDiscount,
    promoError: null,
    promoNotApplied: false,
    total: o.amount,
    free: false,
  };
}

function CopyRow({ label, value, display, big = false }: { label: string; value: string; display?: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
        <p className={`font-black text-brand-text ${big ? "whitespace-nowrap text-base tracking-wide sm:text-lg sm:tracking-wider" : "break-all text-sm"}`}>{display ?? value}</p>
      </div>
      <button
        type="button"
        aria-label={`${label}: nusxa olish`}
        className={`${btnSecondary} shrink-0 !px-2.5 !py-1 text-xs`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked: the value is visible anyway */
          }
        }}
      >
        <Copy className="h-3.5 w-3.5" /> {copied ? "Nusxalandi" : "Nusxa"}
      </button>
    </div>
  );
}

export default function DemoPayPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { state, run, result, clearResult, show } = useDemo();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!state) return <Loading />;

  const user = currentUser(state, "user");
  if (!user) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-black text-brand-text">To‘lov uchun kiring</h1>
        <Link href={`/demo?next=/demo/pay/${orderId}`} className={`${btnPrimary} mt-4`}>
          <LogIn className="h-4 w-4" /> Kirish sahifasi
        </Link>
      </Card>
    );
  }
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.userId !== user.id) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-black text-brand-text">Buyurtma topilmadi</h1>
        <Link href="/demo/kabinet" className={`${btnSecondary} mt-4`}><ArrowLeft className="h-4 w-4" /> Kabinetga qaytish</Link>
      </Card>
    );
  }

  const card = state.settings.paymentCard;
  const promotion = order.promotionId ? state.promotions.find((p) => p.id === order.promotionId) : null;
  const q = orderQuote(order, promotion?.name ?? null, promotion?.percent ?? 0, state.promoCodes.find((p) => p.code === order.promoCode) ?? null);
  const listing = order.kind === "listing" ? state.listings.find((l) => l.id === order.targetId) : null;
  const statusOrder = order.kind === "status" ? state.statusOrders.find((s) => s.id === order.targetId) : null;
  const pay = PAYMENT_UI[order.paymentStatus];
  const canPay = USER_PAYABLE.includes(order.paymentStatus) && order.amount > 0;
  const waiting = order.paymentStatus === "receipt_submitted" || order.paymentStatus === "under_review";

  async function sendReceipt() {
    if (!file) {
      show(false, "Avval chek faylini tanlang (JPG, PNG yoki PDF)");
      return;
    }
    setBusy(true);
    try {
      const r = await readReceiptFile(file, note);
      if (!r.ok) {
        show(false, r.reason);
        return;
      }
      const res = run((s) => submitReceipt(s, user!.id, order!.id, r.input));
      if (res.ok) {
        setFile(null);
        setNote("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/demo/kabinet" className="inline-flex items-center gap-1 text-sm font-bold text-brand-muted hover:text-brand-text">
        <ArrowLeft className="h-4 w-4" /> Kabinet
      </Link>

      <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>DEMO.</b> Bu yerda ko‘rsatilgan karta soxta — unga pul o‘tkazmang. To‘lov faqat simulyatsiya: istalgan JPG, PNG yoki PDF faylni “chek”
          sifatida yuklab, admin tasdig‘ini sinab ko‘rishingiz mumkin.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white"><CreditCard className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-black text-brand-text">Kartaga to‘lov</h1>
              <p className="text-[11px] text-brand-muted">{order.id} · {fmtDate(order.createdAt)}</p>
            </div>
          </div>
          <DemoBadge />
        </div>
        <p className="mb-3 text-sm font-bold text-brand-text">{order.title}</p>
        <PriceBreakdown q={q} />
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-brand-muted">To‘lov holati:</span>
          <Pill tone={pay.tone}>{pay.label}</Pill>
          {listing && (
            <>
              <span className="ml-1 font-bold text-brand-muted">Moderatsiya:</span>
              <Pill tone={MODERATION_UI[listing.moderation].tone}>{MODERATION_UI[listing.moderation].label}</Pill>
            </>
          )}
          {statusOrder && (
            <span className="ml-1 font-bold text-brand-muted">
              Status: {statusOrder.state === "pending_approval" ? "admin tasdig‘ini kutmoqda (hali faol emas)" : statusOrder.state === "awaiting_payment" ? "to‘lov kutilmoqda" : statusOrder.state === "active" ? "faol" : statusOrder.state}
            </span>
          )}
        </div>
      </Card>

      <ResultBanner result={result} onClose={clearResult} />

      {order.adminNote && USER_PAYABLE.includes(order.paymentStatus) && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <b>{order.paymentStatus === "rejected" ? "Admin to‘lovni rad etdi:" : "Admin qo‘shimcha chek yoki ma’lumot so‘radi:"}</b> {order.adminNote}
          </p>
        </div>
      )}

      {canPay && !card.enabled && (
        <Card className="border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900">
          Kartaga to‘lov qabul qilish hozircha o‘chirilgan. Keyinroq qayta urinib ko‘ring — buyurtmangiz saqlanib turadi.
        </Card>
      )}

      {canPay && card.enabled && (
        <>
          <Card className="space-y-2 bg-gradient-to-br from-brand-light to-white">
            <h2 className="text-sm font-black text-brand-text">1. Bank ilovasi orqali shu kartaga o‘tkazing</h2>
            <CopyRow label="Karta raqami (DEMO)" value={card.cardNumber} display={formatCard(card.cardNumber)} big />
            <CopyRow label="Karta egasi" value={card.holder} />
            {card.bank && <CopyRow label="Bank" value={card.bank} />}
            <CopyRow label="To‘lanadigan summa" value={String(order.amount)} display={formatSum(order.amount)} big />
            <CopyRow label="Izohga yozing: buyurtma ID" value={order.id} />
            {card.instructions && <p className="rounded-xl bg-white/70 px-3 py-2 text-xs text-brand-text">{card.instructions}</p>}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-black text-brand-text">2. To‘lov chekini yuklang</h2>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-border-dark px-4 py-6 text-center hover:bg-brand-light/50">
              <Upload className="h-6 w-6 text-brand-primary" />
              <span className="text-sm font-bold text-brand-text">{file ? file.name : "Chek faylini tanlang"}</span>
              <span className="text-[11px] text-brand-muted">
                {file ? `${(file.size / 1024).toFixed(0)} KB` : "JPG yoki PNG (10 MB gacha), PDF (1.5 MB gacha). Fayl ichi tekshiriladi."}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                className="hidden"
                data-testid="receipt-input"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            <div>
              <label className={labelCls} htmlFor="receipt-note">Izoh (ixtiyoriy)</label>
              <textarea id="receipt-note" rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Uzcard ilovasidan, 14:05 da o‘tkazildi" />
            </div>
            <button type="button" className={`${btnPrimary} w-full !py-3 text-base`} disabled={busy} onClick={sendReceipt}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} Chekni yuborish
            </button>
          </Card>
        </>
      )}

      {canPay &&
        (confirmCancel ? (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="font-bold text-rose-700">Buyurtmani bekor qilasizmi?</span>
            <button type="button" className={btnDanger} onClick={() => { setConfirmCancel(false); run((s) => cancelOrder(s, user.id, order.id)); }}>Ha, bekor qilish</button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmCancel(false)}>Yo‘q</button>
          </div>
        ) : (
          <button type="button" className={`${btnSecondary} w-full`} onClick={() => setConfirmCancel(true)}>
            <Ban className="h-4 w-4" /> Buyurtmani bekor qilish
          </button>
        ))}

      {waiting && (
        <Card className="text-center">
          <Clock className="mx-auto h-10 w-10 text-sky-600" />
          <p className="mt-2 text-base font-black text-brand-text">Chek yuborildi — admin tekshirmoqda</p>
          <p className="mt-1 text-sm text-brand-muted">
            Admin bank tushumini mustaqil tekshiradi. Tasdiqlangach {order.kind === "listing" ? "e’lon moderatsiyaga o‘tadi" : "status admin tasdig‘iga o‘tadi"}.
          </p>
        </Card>
      )}

      {isPaidLike(order.paymentStatus) && (
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-2 text-base font-black text-brand-text">To‘lov admin tomonidan tasdiqlangan — {formatSum(order.amount)}</p>
          <p className="mt-1 text-sm text-brand-muted">
            {order.kind === "listing" ? "E’lon moderatsiyadan o‘tgach saytda ko‘rinadi." : "Status muddati admin tasdiqlagan paytdan hisoblanadi."}
            {order.refund?.status === "requested" && " Pul qaytarish so‘rovi ko‘rib chiqilmoqda."}
            {order.refund?.status === "refunded" && " Pul qaytarilgani qayd etilgan."}
            {order.refund?.status === "declined" && " Pul qaytarish rad etilgan."}
          </p>
          <Link href="/demo/kabinet" className={`${btnPrimary} mt-4`}>Mening e’lonlarimga o‘tish</Link>
        </Card>
      )}

      {order.paymentStatus === "cancelled" && (
        <Card className="text-center text-sm text-brand-muted">
          Buyurtma bekor qilingan. Kabinetdan yangi buyurtma yaratishingiz mumkin.
          <div><Link href="/demo/kabinet" className={`${btnSecondary} mt-3`}>Kabinetga qaytish</Link></div>
        </Card>
      )}

      {order.receipts.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-black text-brand-text">Yuborilgan cheklar</h2>
          <ul className="space-y-1 text-xs text-brand-muted">
            {order.receipts.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {r.fileName} · {fmtDate(r.submittedAt)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-brand-subtle">Chek fayllarini faqat admin ko‘radi.</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-black text-brand-text">Buyurtma tarixi</h2>
        <ul className="space-y-0.5 text-xs text-brand-muted">
          {order.events.map((e, i) => (
            <li key={i}>{fmtDate(e.at)} — {e.actor}: {e.text}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
