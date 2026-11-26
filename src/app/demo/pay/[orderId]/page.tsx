"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Ban, ShieldAlert, ArrowLeft, LogIn, CreditCard } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { currentUser, formatSum, payOrder, type Order, type PromoCode, type Quote } from "@/lib/demo/engine";
import { Card, Loading, MODERATION_UI, PAYMENT_UI, Pill, ResultBanner, btnPrimary, btnSecondary, fmtDate } from "@/components/demo/ui";
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
    total: o.amount,
    free: false,
  };
}

export default function DemoPayPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { state, run, result, clearResult, show } = useDemo();
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

  const promotion = order.promotionId ? state.promotions.find((p) => p.id === order.promotionId) : null;
  const q = orderQuote(order, promotion?.name ?? null, promotion?.percent ?? 0, state.promoCodes.find((p) => p.code === order.promoCode) ?? null);
  const listing = order.kind === "listing" ? state.listings.find((l) => l.id === order.targetId) : null;
  const statusOrder = order.kind === "status" ? state.statusOrders.find((s) => s.id === order.targetId) : null;
  const paid = order.paymentStatus === "paid";
  const pay = PAYMENT_UI[order.paymentStatus];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/demo/kabinet" className="inline-flex items-center gap-1 text-sm font-bold text-brand-muted hover:text-brand-text">
        <ArrowLeft className="h-4 w-4" /> Kabinet
      </Link>

      <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>DEMO TO‘LOV.</b> Bu haqiqiy to‘lov sahifasi emas: Payme, Click yoki Uzum ulanmagan, karta so‘ralmaydi va hech qanday pul yechilmaydi.
          Tugmalar faqat natijani simulyatsiya qiladi.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white"><CreditCard className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-black text-brand-text">Buyurtmani to‘lash</h1>
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
              Status: {statusOrder.state === "pending_approval" ? "admin tasdig‘ini kutmoqda (hali faol emas)" : statusOrder.state === "awaiting_payment" ? "to‘lov kutilmoqda" : statusOrder.state}
            </span>
          )}
        </div>
        {order.attempts.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-[11px] text-brand-muted">
            {order.attempts.map((a, i) => (
              <li key={i}>{fmtDate(a.at)} — {a.outcome === "success" ? "muvaffaqiyatli" : a.outcome === "failed" ? "amalga oshmadi" : "bekor qilindi"}</li>
            ))}
          </ul>
        )}
      </Card>

      <ResultBanner result={result} onClose={clearResult} />

      {paid ? (
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-2 text-base font-black text-brand-text">Buyurtma to‘langan (DEMO) — {formatSum(order.amount)}</p>
          <p className="mt-1 text-sm text-brand-muted">
            {order.kind === "listing" ? "E’lon moderatsiyaga yuborildi. Admin tasdiqlagach saytda ko‘rinadi." : "Status admin tasdig‘ini kutmoqda. Muddat tasdiqlangan paytdan hisoblanadi."}
          </p>
          <Link href="/demo/kabinet" className={`${btnPrimary} mt-4`}>Mening e’lonlarimga o‘tish</Link>
        </Card>
      ) : (
        <div className="grid gap-2.5">
          <button type="button" className={`${btnPrimary} !py-3 text-base`} onClick={() => run((s) => payOrder(s, order.id, "success", user.id))}>
            <CheckCircle2 className="h-5 w-5" /> To‘lov muvaffaqiyatli
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98]"
            onClick={() => { const r = run((s) => payOrder(s, order.id, "failed", user.id)); if (r.ok) show(false, r.message); }}
          >
            <XCircle className="h-5 w-5" /> To‘lov amalga oshmadi
          </button>
          <button type="button" className={`${btnSecondary} !py-3 text-base`} onClick={() => { const r = run((s) => payOrder(s, order.id, "cancelled", user.id)); if (r.ok) show(false, r.message); }}>
            <Ban className="h-5 w-5" /> To‘lovni bekor qilish
          </button>
          {(order.paymentStatus === "failed" || order.paymentStatus === "cancelled") && (
            <p className="text-center text-xs text-brand-muted">Buyurtma saqlanib qoldi: qayta urinib ko‘rishingiz yoki keyinroq kabinetdan to‘lashingiz mumkin.</p>
          )}
        </div>
      )}
    </div>
  );
}
