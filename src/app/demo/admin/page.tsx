"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ShieldCheck, Sparkles, Tag, Megaphone, Receipt, ScrollText, LogIn, Check, X, Pencil, RotateCcw, Clock, Power, Save, Trash2, Eye, MessageSquare,
} from "lucide-react";
import { dataUrlToObjectUrl, resetDemoState, useDemo, useTicker } from "@/lib/demo/store";
import {
  STATUS_DAYS, STATUS_NAMES, STATUS_TYPES, approveListing, approveStatus, currentUser, decideRefund, formatSum, nowIso, promotionPhase,
  rejectListing, rejectStatus, requestRevision, savePromo, savePromotion, shiftClock, stats, statusPhase, togglePromo, togglePromotion, updateSettings,
  approvePayment, formatCard, rejectPayment, requestPaymentInfo, startPaymentReview, updatePaymentCard,
  type DemoState, type Listing, type Moderation, type PromoCode, type PromoInput, type Promotion, type PromotionInput, type StatusDays, type StatusType,
  type Order, type PaymentCard, type Receipt as DemoReceipt, type Review,
} from "@/lib/demo/engine";
import {
  Card, Loading, MODERATION_UI, PAYMENT_UI, Pill, REFUND_UI, ResultBanner, STATUS_PHASE_UI, SectionTitle, Toggle, btnDanger, btnPrimary, btnSecondary,
  fmtDate, fromLocalInput, inputCls, labelCls, toLocalInput,
} from "@/components/demo/ui";
import { ListingThumb } from "@/components/demo/parts";

const TABS = [
  { id: "umumiy", label: "Sozlamalar", icon: LayoutDashboard },
  { id: "moderatsiya", label: "Moderatsiya", icon: ShieldCheck },
  { id: "statuslar", label: "Statuslar", icon: Sparkles },
  { id: "promokodlar", label: "Promokodlar", icon: Tag },
  { id: "aksiyalar", label: "Aksiyalar", icon: Megaphone },
  { id: "tolovlar", label: "To‘lovlar", icon: Receipt },
  { id: "jurnal", label: "Jurnal", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Run = ReturnType<typeof useDemo>["run"];

export default function DemoAdmin() {
  const { state, run, result, clearResult, show } = useDemo();
  const [tab, setTab] = useState<TabId>("umumiy");
  useTicker();

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "") as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  if (!state) return <Loading />;
  const admin = currentUser(state, "admin");
  if (!admin) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-black text-brand-text">Admin panel</h1>
        <p className="mt-1 text-sm text-brand-muted">Demo admin hisobi bilan kiring. Foydalanuvchi paneli bilan aralashmaydi.</p>
        <Link href="/demo?next=/demo/admin" className={`${btnPrimary} mt-4`}><LogIn className="h-4 w-4" /> Admin sifatida kirish</Link>
      </Card>
    );
  }
  const st = stats(state);
  const badge: Partial<Record<TabId, number>> = { moderatsiya: st.pendingModeration, statuslar: st.pendingStatuses, tolovlar: st.paymentReviews + st.refundRequests };

  const choose = (id: TabId) => {
    setTab(id);
    clearResult();
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-brand-text sm:text-2xl">Admin panel — monetizatsiya</h1>
          <p className="text-sm text-brand-muted">Demo soati: {fmtDate(nowIso(state))}{state.settings.clockOffsetMs ? " (surilgan)" : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Moderatsiyada" value={st.pendingModeration} />
        <Stat label="Status kutmoqda" value={st.pendingStatuses} />
        <Stat label="To‘lov tekshiruvi" value={st.paymentReviews} />
        <Stat label="Qaytarish so‘rovi" value={st.refundRequests} />
        <Stat label="Demo tushum" value={formatSum(st.revenue)} />
      </div>

      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-brand-border bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm ${tab === t.id ? "bg-brand-primary text-white" : "text-brand-muted hover:bg-brand-light"}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {badge[t.id] ? <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-white/25" : "bg-amber-100 text-amber-800"}`}>{badge[t.id]}</span> : null}
          </button>
        ))}
      </div>

      <ResultBanner result={result} onClose={clearResult} />

      {tab === "umumiy" && <SettingsTab state={state} adminId={admin.id} run={run} onReset={() => { resetDemoState(admin.id); show(true, "Demo ma’lumotlari tozalandi va boshlang‘ich holatga qaytdi. Saytning haqiqiy ma’lumotlariga tegilmadi."); }} />}
      {tab === "moderatsiya" && <ModerationTab state={state} adminId={admin.id} run={run} />}
      {tab === "statuslar" && <StatusesTab state={state} adminId={admin.id} run={run} />}
      {tab === "promokodlar" && <PromoTab state={state} adminId={admin.id} run={run} />}
      {tab === "aksiyalar" && <PromotionsTab state={state} adminId={admin.id} run={run} />}
      {tab === "tolovlar" && <OrdersTab state={state} adminId={admin.id} run={run} />}
      {tab === "jurnal" && <LogTab state={state} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="!py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="text-lg font-black text-brand-text">{value}</p>
    </Card>
  );
}

function MoneyInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <input id={id} inputMode="numeric" className={`${inputCls} pr-12`} value={String(value)} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-subtle">so‘m</span>
    </div>
  );
}

// ------------------------------------------------------------------ payment card

function PaymentCardSettings({ state, adminId, run }: { state: DemoState; adminId: string; run: Run }) {
  const saved = state.settings.paymentCard;
  const [card, setCard] = useState<PaymentCard>({ ...saved, cardNumber: formatCard(saved.cardNumber) });
  useEffect(() => {
    setCard({ ...state.settings.paymentCard, cardNumber: formatCard(state.settings.paymentCard.cardNumber) });
  }, [state.settings.paymentCard]);
  const set = <K extends keyof PaymentCard>(k: K, v: PaymentCard[K]) => setCard({ ...card, [k]: v });
  return (
    <Card className="lg:col-span-2">
      <SectionTitle hint="Foydalanuvchi to‘lov sahifasida shu karta va summani ko‘radi. Faqat admin o‘zgartira oladi. DEMO: haqiqiy karta kiritmang">
        To‘lov kartasi
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="pc-number">Karta raqami</label>
          <input id="pc-number" inputMode="numeric" className={`${inputCls} tracking-wider`} value={card.cardNumber}
            onChange={(e) => set("cardNumber", formatCard(e.target.value.replace(/\D/g, "").slice(0, 16)))} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-holder">Karta egasining ismi</label>
          <input id="pc-holder" className={inputCls} value={card.holder} onChange={(e) => set("holder", e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-bank">Bank nomi (ixtiyoriy)</label>
          <input id="pc-bank" className={inputCls} value={card.bank} onChange={(e) => set("bank", e.target.value)} />
        </div>
        <div className="flex items-end">
          <div className="w-full">
            <Toggle label="To‘lov qabul qilish" hint="O‘chirilsa, foydalanuvchi chek yubora olmaydi" checked={card.enabled} onChange={(v) => set("enabled", v)} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="pc-instr">To‘lov bo‘yicha yo‘riqnoma</label>
          <textarea id="pc-instr" rows={2} className={inputCls} value={card.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </div>
      </div>
      <button type="button" className={`${btnPrimary} mt-3`} onClick={() => run((x) => updatePaymentCard(x, adminId, card))}>
        <Save className="h-4 w-4" /> Kartani saqlash
      </button>
    </Card>
  );
}

// ------------------------------------------------------------------ settings

function SettingsTab({ state, adminId, run, onReset }: { state: DemoState; adminId: string; run: Run; onReset: () => void }) {
  const s = state.settings;
  const [std, setStd] = useState(s.plans.standard.price);
  const [prem, setPrem] = useState(s.plans.premium.price);
  const [premFeatures, setPremFeatures] = useState(s.plans.premium.features.join("\n"));
  const [stdFeatures, setStdFeatures] = useState(s.plans.standard.features.join("\n"));
  const [sp, setSp] = useState(s.statusPrices);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setStd(state.settings.plans.standard.price);
    setPrem(state.settings.plans.premium.price);
    setPremFeatures(state.settings.plans.premium.features.join("\n"));
    setStdFeatures(state.settings.plans.standard.features.join("\n"));
    setSp(state.settings.statusPrices);
  }, [state.settings]);

  const setStatusPrice = (t: StatusType, d: StatusDays, v: number) => setSp({ ...sp, [t]: { ...sp[t], [d]: v } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle hint="O‘zgarish foydalanuvchiga darhol ta’sir qiladi">Monetizatsiya</SectionTitle>
        <div className="space-y-2.5">
          <Toggle label="Monetizatsiya yoqilgan" hint="O‘chirilsa, barcha e’lonlar bepul joylanadi" checked={s.monetizationEnabled} onChange={(v) => run((x) => updateSettings(x, adminId, { monetizationEnabled: v }))} />
          <Toggle label="Birinchi e’lon bepul" hint="Har bir foydalanuvchining birinchi Standart e’loni bepul" checked={s.freeFirstEnabled} onChange={(v) => run((x) => updateSettings(x, adminId, { freeFirstEnabled: v }))} />
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Ikkinchi va keyingi e’lonlar uchun tariflar. TOP hech qaysi tarifga kirmaydi — u alohida sotib olinadi">E’lon tariflari</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="p-std">Standart</label>
            <MoneyInput id="p-std" value={std} onChange={setStd} />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-prem">Premium</label>
            <MoneyInput id="p-prem" value={prem} onChange={setPrem} />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-std-f">Standart imkoniyatlari (har qatorda bittasi)</label>
            <textarea id="p-std-f" rows={3} className={inputCls} value={stdFeatures} onChange={(e) => setStdFeatures(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-prem-f">Premium imkoniyatlari (har qatorda bittasi)</label>
            <textarea id="p-prem-f" rows={3} className={inputCls} value={premFeatures} onChange={(e) => setPremFeatures(e.target.value)} />
          </div>
        </div>
        <button type="button" className={`${btnPrimary} mt-3`} onClick={() => run((x) => updateSettings(x, adminId, { planPrices: { standard: std, premium: prem }, premiumFeatures: premFeatures.split("\n"), standardFeatures: stdFeatures.split("\n") }))}>
          <Save className="h-4 w-4" /> E’lon narxlarini saqlash
        </button>
      </Card>

      <Card className="lg:col-span-2">
        <SectionTitle hint="3 / 7 / 30 kunlik tariflar. Muddat admin tasdiqlagan paytdan hisoblanadi">Status narxlari</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-brand-muted">
                <th className="pb-2">Status</th>
                {STATUS_DAYS.map((d) => <th key={d} className="pb-2">{d} kun</th>)}
              </tr>
            </thead>
            <tbody>
              {STATUS_TYPES.map((t) => (
                <tr key={t} className="border-t border-brand-border">
                  <td className="py-2 pr-3 font-black text-brand-text">{STATUS_NAMES[t].uz}</td>
                  {STATUS_DAYS.map((d) => (
                    <td key={d} className="py-2 pr-2">
                      <MoneyInput id={`sp-${t}-${d}`} value={sp[t][d]} onChange={(v) => setStatusPrice(t, d, v)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className={`${btnPrimary} mt-3`} onClick={() => run((x) => updateSettings(x, adminId, { statusPrices: sp }))}>
          <Save className="h-4 w-4" /> Status narxlarini saqlash
        </button>
      </Card>

      <PaymentCardSettings state={state} adminId={adminId} run={run} />

      <Card>
        <SectionTitle hint="Faqat demo uchun: statuslar muddati tugashini kutmasdan tekshirish">Demo soati</SectionTitle>
        <p className="mb-3 text-sm text-brand-text">Hozirgi demo vaqti: <b>{fmtDate(nowIso(state))}</b></p>
        <div className="flex flex-wrap gap-2">
          {[1, 3, 7, 30].map((d) => (
            <button key={d} type="button" className={btnSecondary} onClick={() => run((x) => shiftClock(x, adminId, d))}>
              <Clock className="h-4 w-4" /> +{d} kun
            </button>
          ))}
          <button type="button" className={btnSecondary} onClick={() => run((x) => shiftClock(x, adminId, "reset"))}>
            <RotateCcw className="h-4 w-4" /> Haqiqiy vaqt
          </button>
        </div>
      </Card>

      <Card className="border-rose-200">
        <SectionTitle hint="Faqat shu brauzerdagi demo ma’lumotlari o‘chadi. Saytning haqiqiy e’lonlari va bazaga tegilmaydi">Reset Demo</SectionTitle>
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-rose-700">Barcha demo e’lonlar, to‘lovlar, statuslar o‘chiriladi. Davom etasizmi?</span>
            <button type="button" className={btnDanger} onClick={() => { setConfirmReset(false); onReset(); }}>
              <Trash2 className="h-4 w-4" /> Ha, tozalash
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmReset(false)}>Yo‘q</button>
          </div>
        ) : (
          <button type="button" className={btnDanger} onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" /> Reset Demo
          </button>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ moderation

function ModerationTab({ state, adminId, run }: { state: DemoState; adminId: string; run: Run }) {
  const [filter, setFilter] = useState<Moderation | "all">("pending");
  const list = state.listings.filter((l) => filter === "all" || l.moderation === filter);
  const filters: { id: Moderation | "all"; label: string }[] = [
    { id: "pending", label: "Moderatsiyada" },
    { id: "revision", label: "Tuzatishda" },
    { id: "approved", label: "Tasdiqlangan" },
    { id: "rejected", label: "Rad etilgan" },
    { id: "not_submitted", label: "To‘lanmagan" },
    { id: "all", label: "Hammasi" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const n = f.id === "all" ? state.listings.length : state.listings.filter((l) => l.moderation === f.id).length;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === f.id ? "border-brand-primary bg-brand-light text-brand-primary" : "border-brand-border bg-white text-brand-muted"}`}>
              {f.label} ({n})
            </button>
          );
        })}
      </div>
      {list.length === 0 ? <Card className="text-sm text-brand-muted">Bu bo‘limda e’lon yo‘q.</Card> : list.map((l) => <ModerationCard key={l.id} state={state} listing={l} adminId={adminId} run={run} />)}
    </div>
  );
}

function ModerationCard({ state, listing: l, adminId, run }: { state: DemoState; listing: Listing; adminId: string; run: Run }) {
  const [mode, setMode] = useState<null | "reject" | "revision">(null);
  const [text, setText] = useState("");
  const owner = state.users.find((u) => u.id === l.userId);
  const order = l.orderId ? state.orders.find((o) => o.id === l.orderId) : null;
  const pay = l.billing === "free" ? PAYMENT_UI.free : order ? PAYMENT_UI[order.paymentStatus] : null;
  const submit = () => {
    const r = run((x) => (mode === "reject" ? rejectListing(x, adminId, l.id, text) : requestRevision(x, adminId, l.id, text)));
    if (r.ok) { setMode(null); setText(""); }
  };
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl border border-brand-border sm:h-24 sm:w-32"><ListingThumb photos={l.photos} title={l.title} /></div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-sm font-black text-brand-text sm:text-base">{l.title}</h3>
            <p className="text-xs text-brand-muted">
              {owner?.name} · {l.phone} · {l.location} · {l.price.toLocaleString("ru-RU")} {l.currency === "USD" ? "$" : "so‘m"} · {state.settings.plans[l.plan]?.nameUz}
            </p>
            {l.description && <p className="mt-1 line-clamp-2 text-xs text-brand-text">{l.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-brand-muted">To‘lov:</span>
            {pay && <Pill tone={pay.tone}>{pay.label}</Pill>}
            {order && order.amount > 0 && <span className="text-[11px] font-bold">{formatSum(order.amount)}</span>}
            <span className="ml-1 text-[11px] font-bold text-brand-muted">Moderatsiya:</span>
            <Pill tone={MODERATION_UI[l.moderation].tone}>{MODERATION_UI[l.moderation].label}</Pill>
            {order?.refund && <Pill tone={REFUND_UI[order.refund.status].tone}>{REFUND_UI[order.refund.status].label}</Pill>}
            {l.plan === "premium" && <Pill tone="violet">Premium</Pill>}
          </div>
          {l.rejectReason && l.moderation === "rejected" && <p className="text-xs text-rose-700">Sabab: {l.rejectReason}</p>}
          {l.revisionNote && l.moderation === "revision" && <p className="text-xs text-orange-700">So‘ralgan tuzatish: {l.revisionNote}</p>}
          {mode ? (
            <div className="space-y-2 rounded-xl border border-brand-border bg-brand-canvas p-3">
              <label className={labelCls} htmlFor={`txt-${l.id}`}>{mode === "reject" ? "Rad etish sababi" : "Nimani tuzatish kerak"}</label>
              <textarea id={`txt-${l.id}`} rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)}
                placeholder={mode === "reject" ? "Masalan: rasmlar mulkka tegishli emas" : "Masalan: narxni va xonalar sonini aniqlang"} />
              <div className="flex gap-2">
                <button type="button" className={mode === "reject" ? btnDanger : btnPrimary} onClick={submit}>{mode === "reject" ? "Rad etish" : "Tuzatishga yuborish"}</button>
                <button type="button" className={btnSecondary} onClick={() => { setMode(null); setText(""); }}>Bekor</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {l.moderation === "pending" && (
                <>
                  <button type="button" className={`${btnPrimary} !py-1.5 text-xs`} onClick={() => run((x) => approveListing(x, adminId, l.id))}><Check className="h-3.5 w-3.5" /> Tasdiqlash</button>
                  <button type="button" className={`${btnSecondary} !py-1.5 text-xs`} onClick={() => setMode("revision")}><Pencil className="h-3.5 w-3.5" /> Tuzatish so‘rash</button>
                </>
              )}
              {(l.moderation === "pending" || l.moderation === "approved" || l.moderation === "revision") && (
                <button type="button" className={`${btnDanger} !py-1.5 text-xs`} onClick={() => setMode("reject")}><X className="h-3.5 w-3.5" /> {l.moderation === "approved" ? "Rad etish (saytdan olish)" : "Rad etish"}</button>
              )}
              {l.moderation === "not_submitted" && <span className="text-xs text-brand-muted">To‘lov qilinmaguncha moderatsiyaga tushmaydi.</span>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ statuses

function StatusesTab({ state, adminId, run }: { state: DemoState; adminId: string; run: Run }) {
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const groups: { title: string; hint: string; phases: string[] }[] = [
    { title: "Tasdiq kutayotganlar", hint: "To‘langan, lekin hali faol emas", phases: ["pending_approval"] },
    { title: "Faol statuslar", hint: "Saytda ko‘rinmoqda", phases: ["active"] },
    { title: "Muddati tugaganlar", hint: "Avtomatik o‘chgan", phases: ["expired"] },
    { title: "Boshqalar", hint: "To‘lanmagan, rad etilgan yoki bekor qilingan", phases: ["awaiting_payment", "rejected", "cancelled"] },
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const rows = state.statusOrders.filter((so) => g.phases.includes(statusPhase(state, so)));
        return (
          <section key={g.title}>
            <SectionTitle hint={g.hint}>{g.title} ({rows.length})</SectionTitle>
            {rows.length === 0 ? <Card className="text-sm text-brand-muted">Yo‘q.</Card> : (
              <Card className="!p-0 overflow-hidden">
                <div className="divide-y divide-brand-border">
                  {rows.map((so) => {
                    const l = state.listings.find((x) => x.id === so.listingId);
                    const owner = state.users.find((u) => u.id === so.userId);
                    const order = so.orderId ? state.orders.find((o) => o.id === so.orderId) : null;
                    const ph = statusPhase(state, so);
                    return (
                      <div key={so.id} className="space-y-2 px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone="indigo">{STATUS_NAMES[so.type].uz}</Pill>
                          <b className="text-brand-text">{so.days} kun</b>
                          <Pill tone={STATUS_PHASE_UI[ph].tone}>{STATUS_PHASE_UI[ph].label}</Pill>
                          <span className="min-w-0 truncate text-brand-muted">{l?.title} · {owner?.name}</span>
                          {order && <span className="text-xs font-bold text-brand-text">{formatSum(order.amount)} · {PAYMENT_UI[order.paymentStatus].label}</span>}
                        </div>
                        <p className="text-xs text-brand-muted">
                          Buyurtma: {fmtDate(so.createdAt)}{so.approvedAt ? ` · Tasdiqlangan: ${fmtDate(so.approvedAt)}` : ""}{so.endsAt ? ` · Tugaydi: ${fmtDate(so.endsAt)}` : ""}
                          {so.rejectReason ? ` · Sabab: ${so.rejectReason}` : ""}
                        </p>
                        {ph === "pending_approval" && (rejecting === so.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input aria-label="Rad etish sababi" className={`${inputCls} !w-auto flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sabab" />
                            <button type="button" className={`${btnDanger} !py-1.5 text-xs`} onClick={() => { const r = run((x) => rejectStatus(x, adminId, so.id, reason)); if (r.ok) { setRejecting(null); setReason(""); } }}>Rad etish</button>
                            <button type="button" className={`${btnSecondary} !py-1.5 text-xs`} onClick={() => setRejecting(null)}>Bekor</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button type="button" className={`${btnPrimary} !py-1.5 text-xs`} onClick={() => run((x) => approveStatus(x, adminId, so.id))}><Check className="h-3.5 w-3.5" /> Tasdiqlash</button>
                            <button type="button" className={`${btnDanger} !py-1.5 text-xs`} onClick={() => { setRejecting(so.id); setReason(""); }}><X className="h-3.5 w-3.5" /> Rad etish</button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ promo codes

function emptyPromo(state: DemoState): PromoInput {
  const now = Date.parse(nowIso(state));
  return { code: "", kind: "percent", value: 10, target: "all", validFrom: new Date(now).toISOString(), validTo: new Date(now + 30 * 86400000).toISOString(), usageLimit: 10, active: true };
}

function PromoTab({ state, adminId, run }: { state: DemoState; adminId: string; run: Run }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoInput>(() => emptyPromo(state));
  const set = <K extends keyof PromoInput>(k: K, v: PromoInput[K]) => setForm({ ...form, [k]: v });
  const edit = (p: PromoCode) => { setEditId(p.id); setForm({ code: p.code, kind: p.kind, value: p.value, target: p.target, validFrom: p.validFrom, validTo: p.validTo, usageLimit: p.usageLimit, active: p.active }); };
  const now = Date.parse(nowIso(state));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <SectionTitle>{editId ? "Promokodni tahrirlash" : "Yangi promokod"}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pc-code">Kod</label>
            <input id="pc-code" className={`${inputCls} uppercase`} value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="YANGI25" />
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-kind">Turi</label>
            <select id="pc-kind" className={inputCls} value={form.kind} onChange={(e) => set("kind", e.target.value as PromoInput["kind"])}>
              <option value="percent">Foiz (%)</option>
              <option value="fixed">Qat’iy summa (so‘m)</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-value">{form.kind === "percent" ? "Foiz" : "Summa"}</label>
            <input id="pc-value" inputMode="numeric" className={inputCls} value={String(form.value)} onChange={(e) => set("value", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-target">Nimaga</label>
            <select id="pc-target" className={inputCls} value={form.target} onChange={(e) => set("target", e.target.value as PromoInput["target"])}>
              <option value="all">Hammasiga</option>
              <option value="listing">Faqat e’lon</option>
              <option value="status">Faqat status</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-limit">Limit (0 = cheksiz)</label>
            <input id="pc-limit" inputMode="numeric" className={inputCls} value={String(form.usageLimit)} onChange={(e) => set("usageLimit", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-from">Boshlanishi</label>
            <input id="pc-from" type="datetime-local" className={inputCls} value={toLocalInput(form.validFrom)} onChange={(e) => set("validFrom", fromLocalInput(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pc-to">Tugashi</label>
            <input id="pc-to" type="datetime-local" className={inputCls} value={toLocalInput(form.validTo)} onChange={(e) => set("validTo", fromLocalInput(e.target.value))} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className={btnPrimary} onClick={() => { const r = run((x) => savePromo(x, adminId, form, editId ?? undefined)); if (r.ok) { setEditId(null); setForm(emptyPromo(r.state)); } }}>
            <Save className="h-4 w-4" /> Saqlash
          </button>
          {editId && <button type="button" className={btnSecondary} onClick={() => { setEditId(null); setForm(emptyPromo(state)); }}>Bekor</button>}
        </div>
      </Card>
      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-brand-border">
          {state.promoCodes.map((p) => {
            const expired = now > Date.parse(p.validTo);
            const notYet = now < Date.parse(p.validFrom);
            const exhausted = p.usageLimit > 0 && p.used >= p.usageLimit;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <code className="rounded-lg bg-brand-light px-2 py-0.5 font-black text-brand-primary">{p.code}</code>
                <span className="font-bold text-brand-text">{p.kind === "percent" ? `−${p.value}%` : `−${formatSum(p.value)}`}</span>
                <span className="text-xs text-brand-muted">{p.target === "all" ? "hammasiga" : p.target === "listing" ? "e’lon" : "status"} · {p.used}/{p.usageLimit || "∞"} · {fmtDate(p.validFrom)} – {fmtDate(p.validTo)}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {!p.active ? <Pill tone="slate">O‘chiq</Pill> : expired ? <Pill tone="slate">Muddati o‘tgan</Pill> : notYet ? <Pill tone="indigo">Hali boshlanmagan</Pill> : exhausted ? <Pill tone="orange">Limit tugagan</Pill> : <Pill tone="emerald">Faol</Pill>}
                  <button type="button" className={`${btnSecondary} !px-2 !py-1 text-xs`} onClick={() => edit(p)} aria-label={`${p.code} tahrirlash`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" className={`${btnSecondary} !px-2 !py-1 text-xs`} onClick={() => run((x) => togglePromo(x, adminId, p.id))}><Power className="h-3.5 w-3.5" /> {p.active ? "O‘chirish" : "Yoqish"}</button>
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ promotions

function emptyPromotion(state: DemoState): PromotionInput {
  const now = Date.parse(nowIso(state));
  return { name: "", description: "", percent: 20, target: "all", startsAt: new Date(now).toISOString(), endsAt: new Date(now + 7 * 86400000).toISOString(), active: true };
}

function PromotionsTab({ state, adminId, run }: { state: DemoState; adminId: string; run: Run }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionInput>(() => emptyPromotion(state));
  const set = <K extends keyof PromotionInput>(k: K, v: PromotionInput[K]) => setForm({ ...form, [k]: v });
  const edit = (p: Promotion) => { setEditId(p.id); setForm({ name: p.name, description: p.description, percent: p.percent, target: p.target, startsAt: p.startsAt, endsAt: p.endsAt, active: p.active }); };
  const phaseUi = { running: { label: "Davom etmoqda", tone: "emerald" }, scheduled: { label: "Rejalashtirilgan", tone: "indigo" }, ended: { label: "Tugagan", tone: "slate" }, off: { label: "To‘xtatilgan", tone: "slate" } } as const;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <SectionTitle hint="Faol aksiya davrida chegirma avtomatik qo‘llanadi (promokoddan oldin)">{editId ? "Aksiyani tahrirlash" : "Yangi aksiya"}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pr-name">Nomi</label>
            <input id="pr-name" className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Navro‘z aksiyasi" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="pr-desc">Tavsif</label>
            <input id="pr-desc" className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-pct">Chegirma, %</label>
            <input id="pr-pct" inputMode="numeric" className={inputCls} value={String(form.percent)} onChange={(e) => set("percent", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-target">Nimaga</label>
            <select id="pr-target" className={inputCls} value={form.target} onChange={(e) => set("target", e.target.value as PromotionInput["target"])}>
              <option value="all">Hammasiga</option>
              <option value="listing">Faqat e’lon</option>
              <option value="status">Faqat status</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-from">Boshlanishi</label>
            <input id="pr-from" type="datetime-local" className={inputCls} value={toLocalInput(form.startsAt)} onChange={(e) => set("startsAt", fromLocalInput(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pr-to">Tugashi</label>
            <input id="pr-to" type="datetime-local" className={inputCls} value={toLocalInput(form.endsAt)} onChange={(e) => set("endsAt", fromLocalInput(e.target.value))} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className={btnPrimary} onClick={() => { const r = run((x) => savePromotion(x, adminId, form, editId ?? undefined)); if (r.ok) { setEditId(null); setForm(emptyPromotion(r.state)); } }}>
            <Save className="h-4 w-4" /> Saqlash
          </button>
          {editId && <button type="button" className={btnSecondary} onClick={() => { setEditId(null); setForm(emptyPromotion(state)); }}>Bekor</button>}
        </div>
      </Card>
      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-brand-border">
          {state.promotions.length === 0 && <p className="px-4 py-3 text-sm text-brand-muted">Aksiyalar yo‘q.</p>}
          {state.promotions.map((p) => {
            const ph = phaseUi[promotionPhase(state, p)];
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-brand-text">{p.name} · −{p.percent}%</p>
                  <p className="text-xs text-brand-muted">{p.description || "—"} · {p.target === "all" ? "hammasiga" : p.target === "listing" ? "e’lon" : "status"} · {fmtDate(p.startsAt)} – {fmtDate(p.endsAt)}</p>
                </div>
                <Pill tone={ph.tone}>{ph.label}</Pill>
                <button type="button" className={`${btnSecondary} !px-2 !py-1 text-xs`} onClick={() => edit(p)} aria-label={`${p.name} tahrirlash`}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" className={`${btnSecondary} !px-2 !py-1 text-xs`} onClick={() => run((x) => togglePromotion(x, adminId, p.id))}><Power className="h-3.5 w-3.5" /> {p.active ? "To‘xtatish" : "Faollashtirish"}</button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ payments, receipts & refunds

function ReceiptViewer({ receipt }: { receipt: DemoReceipt }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = dataUrlToObjectUrl(receipt.dataUrl);
    setUrl(u);
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [receipt.dataUrl]);
  return (
    <div className="space-y-2 rounded-xl border border-brand-border bg-brand-canvas p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-muted">
        <span className="font-bold text-brand-text">{receipt.fileName}</span>
        <span>{receipt.mime === "application/pdf" ? "PDF" : receipt.mime === "image/png" ? "PNG" : "JPG"} · {(receipt.size / 1024).toFixed(0)} KB</span>
        <span>{fmtDate(receipt.submittedAt)}</span>
        <span title={receipt.hash}>SHA-256: {receipt.hash.slice(0, 12)}…</span>
        {url && <a href={url} download={receipt.fileName} className="font-bold text-brand-primary hover:underline">Yuklab olish</a>}
      </div>
      {receipt.note && <p className="text-xs text-brand-text">Foydalanuvchi izohi: {receipt.note}</p>}
      {receipt.mime === "application/pdf" ? (
        url ? <iframe title={`Chek ${receipt.fileName}`} src={url} className="h-96 w-full rounded-lg border border-brand-border bg-white" /> : null
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={receipt.dataUrl} alt={`Chek ${receipt.fileName}`} className="max-h-96 w-auto rounded-lg border border-brand-border bg-white" />
      )}
    </div>
  );
}

const DECISION_LABEL: Record<Review["decision"], string> = {
  started: "Tekshiruvga olindi",
  approved: "Tasdiqlandi",
  rejected: "Rad etildi",
  info_requested: "Qo‘shimcha ma’lumot so‘raldi",
};

function PaymentRequestCard({ state, order: o, adminId, run }: { state: DemoState; order: Order; adminId: string; run: Run }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<null | "reject" | "info">(null);
  const [text, setText] = useState("");
  const user = state.users.find((u) => u.id === o.userId);
  const last = o.receipts[o.receipts.length - 1];
  const lastReview = o.reviews[o.reviews.length - 1];
  const reviewable = o.paymentStatus === "receipt_submitted" || o.paymentStatus === "under_review";
  const pay = PAYMENT_UI[o.paymentStatus];

  const viewReceipt = () => {
    const next = !open;
    setOpen(next);
    if (next && o.paymentStatus === "receipt_submitted") run((x) => startPaymentReview(x, adminId, o.id));
  };
  const submit = () => {
    const r = run((x) => (mode === "reject" ? rejectPayment(x, adminId, o.id, text) : requestPaymentInfo(x, adminId, o.id, text)));
    if (r.ok) { setMode(null); setText(""); }
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-brand-text">{o.title}</p>
          <p className="text-[11px] text-brand-muted">ID: {o.id}</p>
        </div>
        <Pill tone={pay.tone}>{pay.label}</Pill>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div><dt className="font-bold text-brand-muted">Foydalanuvchi</dt><dd className="text-brand-text">{user?.name}</dd></div>
        <div><dt className="font-bold text-brand-muted">Tarif / status</dt><dd className="text-brand-text">{o.kind === "listing" ? "E’lon tarifi" : "Status"}</dd></div>
        <div><dt className="font-bold text-brand-muted">Yakuniy summa</dt><dd className="font-black text-brand-text">{formatSum(o.amount)}</dd></div>
        <div><dt className="font-bold text-brand-muted">Chek yuborilgan</dt><dd className="text-brand-text">{fmtDate(o.submittedAt)}</dd></div>
        <div><dt className="font-bold text-brand-muted">Chek fayli</dt><dd className="text-brand-text">{last ? `${last.fileName} (${o.receipts.length} ta)` : "—"}</dd></div>
        <div><dt className="font-bold text-brand-muted">Admin qarori</dt><dd className="text-brand-text">{lastReview ? `${DECISION_LABEL[lastReview.decision]} · ${fmtDate(lastReview.at)}` : "—"}</dd></div>
        <div className="col-span-2"><dt className="font-bold text-brand-muted">Rad etish sababi / so‘rov</dt><dd className="text-brand-text">{o.adminNote ?? [...o.reviews].reverse().find((r) => r.note)?.note ?? "—"}</dd></div>
      </dl>
      {o.refund && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <b>Qaytarish (to‘lovdan alohida):</b> {REFUND_UI[o.refund.status].label} · {formatSum(o.refund.amount)} · {o.refund.reason} · so‘raldi {fmtDate(o.refund.requestedAt)}
          {o.refund.decidedAt ? ` · qaror: ${o.refund.decidedBy}, ${fmtDate(o.refund.decidedAt)}` : ""}
        </p>
      )}
      {last && (
        <button type="button" className={`${btnSecondary} !py-1.5 text-xs`} onClick={viewReceipt}>
          <Eye className="h-3.5 w-3.5" /> {open ? "Chekni yopish" : "Chekni ko‘rish"}
        </button>
      )}
      {open && last && (
        <div className="space-y-2">
          <ReceiptViewer receipt={last} />
          {o.receipts.length > 1 && (
            <p className="text-[11px] text-brand-muted">Oldingi cheklar: {o.receipts.slice(0, -1).map((r) => `${r.fileName} (${fmtDate(r.submittedAt)})`).join(", ")}</p>
          )}
        </div>
      )}
      {reviewable && (
        mode ? (
          <div className="space-y-2 rounded-xl border border-brand-border bg-brand-canvas p-3">
            <label className={labelCls} htmlFor={`pay-txt-${o.id}`}>{mode === "reject" ? "Rad etish sababi" : "Qanday chek yoki ma’lumot kerak"}</label>
            <textarea id={`pay-txt-${o.id}`} rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={mode === "reject" ? "Masalan: bank hisobiga bu summa tushmagan" : "Masalan: chekning to‘liq skrinshotini yuboring"} />
            <div className="flex gap-2">
              <button type="button" className={mode === "reject" ? btnDanger : btnPrimary} onClick={submit}>{mode === "reject" ? "Rad etish" : "So‘rov yuborish"}</button>
              <button type="button" className={btnSecondary} onClick={() => { setMode(null); setText(""); }}>Bekor</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${btnPrimary} !py-1.5 text-xs`} onClick={() => run((x) => approvePayment(x, adminId, o.id))}>
              <Check className="h-3.5 w-3.5" /> Tasdiqlash (pul tushdi)
            </button>
            <button type="button" className={`${btnDanger} !py-1.5 text-xs`} onClick={() => setMode("reject")}><X className="h-3.5 w-3.5" /> Rad etish</button>
            <button type="button" className={`${btnSecondary} !py-1.5 text-xs`} onClick={() => setMode("info")}><MessageSquare className="h-3.5 w-3.5" /> Qo‘shimcha chek/ma’lumot so‘rash</button>
            <span className="text-[11px] text-brand-muted">Tasdiqlashdan oldin bank ilovasida tushumni o‘zingiz tekshiring.</span>
          </div>
        )
      )}
      {o.refund?.status === "requested" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btnPrimary} !py-1.5 text-xs`} onClick={() => run((x) => decideRefund(x, adminId, o.id, "refunded"))}><Check className="h-3.5 w-3.5" /> Pul qaytarildi deb qayd etish</button>
          <button type="button" className={`${btnDanger} !py-1.5 text-xs`} onClick={() => run((x) => decideRefund(x, adminId, o.id, "declined"))}><X className="h-3.5 w-3.5" /> Qaytarishni rad etish</button>
        </div>
      )}
      <details className="text-xs text-brand-muted">
        <summary className="cursor-pointer font-bold hover:text-brand-text">Buyurtma tarixi</summary>
        <ul className="mt-1.5 space-y-0.5 pl-1">
          {o.events.map((e, i) => <li key={i}>{fmtDate(e.at)} — {e.actor}: {e.text}</li>)}
        </ul>
      </details>
    </Card>
  );
}

function OrdersTab({ state, adminId, run }: { state: DemoState; adminId: string; run: Run }) {
  type F = "review" | "awaiting" | "paid" | "rejected" | "refund" | "all";
  const [filter, setFilter] = useState<F>("review");
  const match: Record<F, (o: Order) => boolean> = {
    review: (o) => o.paymentStatus === "receipt_submitted" || o.paymentStatus === "under_review",
    awaiting: (o) => o.paymentStatus === "awaiting_payment" || o.paymentStatus === "info_requested",
    paid: (o) => o.paymentStatus === "paid",
    rejected: (o) => o.paymentStatus === "rejected" || o.paymentStatus === "cancelled",
    refund: (o) => o.refund !== null,
    all: () => true,
  };
  const labels: Record<F, string> = {
    review: "Tekshirish kerak",
    awaiting: "To‘lov kutilmoqda",
    paid: "To‘langan",
    rejected: "Rad etilgan / bekor",
    refund: "Qaytarish",
    all: "Hammasi",
  };
  const list = state.orders.filter(match[filter]);
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
        Qo‘lda karta orqali to‘lov: chekni ko‘ring, bank tushumini mustaqil tekshiring, keyin tasdiqlang. Tasdiqlangan e’lon avtomatik chop etilmaydi — avval moderatsiyadan o‘tadi. DEMO: haqiqiy bank operatsiyasi yo‘q.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(labels) as F[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === f ? "border-brand-primary bg-brand-light text-brand-primary" : "border-brand-border bg-white text-brand-muted"}`}>
            {labels[f]} ({state.orders.filter(match[f]).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? <Card className="text-sm text-brand-muted">Bu bo‘limda buyurtma yo‘q.</Card> : list.map((o) => <PaymentRequestCard key={o.id} state={state} order={o} adminId={adminId} run={run} />)}
    </div>
  );
}

function LogTab({ state }: { state: DemoState }) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="divide-y divide-brand-border">
        {state.log.map((e, i) => (
          <div key={i} className="flex flex-wrap gap-x-3 px-4 py-2 text-sm">
            <span className="text-xs text-brand-muted">{fmtDate(e.at)}</span>
            <b className="text-xs text-brand-text">{e.actor}</b>
            <span className="text-brand-text">{e.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
