"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, CreditCard, Pencil, Sparkles, Eye, Gift, Wallet, ClipboardList, X, LogIn, History } from "lucide-react";
import { useDemo, useTicker } from "@/lib/demo/store";
import {
  STATUS_DAYS, STATUS_NAMES, STATUS_TYPES, createListing, createStatusOrder, currentUser, formatSum, hasFreeRight, listingQuote,
  nowMs, resubmitListing, statusPhase, statusQuote,
  type ActionResult, type DemoState, type Listing, type ListingInput, type ListingPlanId, type StatusDays, type StatusType,
} from "@/lib/demo/engine";
import {
  Card, Loading, MODERATION_UI, PAYMENT_UI, Pill, REFUND_UI, ResultBanner, STATUS_PHASE_UI, SectionTitle, btnPrimary, btnSecondary, fmtDate,
} from "@/components/demo/ui";
import { EMPTY_LISTING, ListingFields, ListingThumb, PriceBreakdown, PromoInput } from "@/components/demo/parts";

type Mode = null | { kind: "new" } | { kind: "revise"; id: string } | { kind: "status"; id: string };

function timeLeft(state: DemoState, endsAt: string | null): string {
  if (!endsAt) return "";
  const ms = Date.parse(endsAt) - nowMs(state);
  if (ms <= 0) return "tugagan";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} kun ${h} soat qoldi` : `${h} soat ${Math.floor((ms % 3600000) / 60000)} daqiqa qoldi`;
}

export default function DemoKabinet() {
  const router = useRouter();
  const { state, run, result, clearResult } = useDemo();
  const [mode, setMode] = useState<Mode>(null);
  useTicker();

  if (!state) return <Loading />;
  const user = currentUser(state, "user");
  if (!user) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-black text-brand-text">Kabinet uchun kiring</h1>
        <p className="mt-1 text-sm text-brand-muted">Demo foydalanuvchi hisobi bilan kiring (login va parol kirish sahifasida yozilgan).</p>
        <Link href="/demo?next=/demo/kabinet" className={`${btnPrimary} mt-4`}>
          <LogIn className="h-4 w-4" /> Kirish sahifasi
        </Link>
      </Card>
    );
  }

  const mine = state.listings.filter((l) => l.userId === user.id);
  const myOrders = state.orders.filter((o) => o.userId === user.id);
  const free = hasFreeRight(state, user.id);
  const nextQuote = listingQuote(state, user.id, "standard");

  const afterCreate = (r: ActionResult) => {
    setMode(null);
    const o = r.orderId ? r.state.orders.find((x) => x.id === r.orderId) : null;
    if (o && o.paymentStatus === "pending" && o.amount > 0) router.push(`/demo/pay/${o.id}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-brand-text sm:text-2xl">Mening kabinetim</h1>
          <p className="text-sm text-brand-muted">{user.name} · demo foydalanuvchi</p>
        </div>
        {mode?.kind !== "new" && (
          <button type="button" className={btnPrimary} onClick={() => { clearResult(); setMode({ kind: "new" }); }}>
            <Plus className="h-4 w-4" /> Yangi e’lon
          </button>
        )}
      </div>

      <ResultBanner result={result} onClose={clearResult} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile icon={Gift} label="Bepul e’lon huquqi" value={!state.settings.monetizationEnabled ? "Monetizatsiya o‘chiq" : free ? "Bor (1 ta)" : "Ishlatilgan"} tone={free ? "text-emerald-700" : "text-brand-text"} />
        <Tile icon={Wallet} label="Keyingi e’lon narxi" value={nextQuote.free ? "Bepul" : formatSum(nextQuote.total)} />
        <Tile icon={ClipboardList} label="Mening e’lonlarim" value={String(mine.length)} />
      </div>

      {mode?.kind === "new" && <NewListingPanel state={state} userId={user.id} onClose={() => setMode(null)} run={run} onCreated={afterCreate} />}
      {mode?.kind === "revise" && (
        <RevisePanel listing={mine.find((l) => l.id === mode.id)!} onClose={() => setMode(null)} onSubmit={(input) => {
          const r = run((s) => resubmitListing(s, user.id, mode.id, input));
          if (r.ok) setMode(null);
        }} />
      )}
      {mode?.kind === "status" && (
        <StatusPanel state={state} listing={mine.find((l) => l.id === mode.id)!} onClose={() => setMode(null)} onBuy={(type, days, promo) => {
          const r = run((s) => createStatusOrder(s, user.id, mode.id, type, days, promo));
          if (r.ok) afterCreate(r);
        }} />
      )}

      <section>
        <SectionTitle hint="To‘lov holati va moderatsiya holati alohida ko‘rsatiladi">Mening e’lonlarim</SectionTitle>
        {mine.length === 0 ? (
          <Card className="text-center text-sm text-brand-muted">Hali e’lon yo‘q. “Yangi e’lon” tugmasini bosing — birinchisi bepul.</Card>
        ) : (
          <div className="space-y-3">
            {mine.map((l) => (
              <ListingRow key={l.id} state={state} listing={l} onPay={(id) => router.push(`/demo/pay/${id}`)} onRevise={() => { clearResult(); setMode({ kind: "revise", id: l.id }); }} onStatus={() => { clearResult(); setMode({ kind: "status", id: l.id }); }} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle hint="Barcha to‘lovlar DEMO — haqiqiy pul yechilmagan">To‘lovlarim</SectionTitle>
        {myOrders.length === 0 ? (
          <Card className="text-sm text-brand-muted">Buyurtmalar yo‘q.</Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="divide-y divide-brand-border">
              {myOrders.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-brand-text">{o.title}</p>
                    <p className="text-xs text-brand-muted">{fmtDate(o.createdAt)} · {o.id}</p>
                  </div>
                  <span className="font-black text-brand-text">{formatSum(o.amount)}</span>
                  <Pill tone={PAYMENT_UI[o.paymentStatus].tone}>{PAYMENT_UI[o.paymentStatus].label}</Pill>
                  {o.refundStatus !== "none" && <Pill tone={REFUND_UI[o.refundStatus].tone}>{REFUND_UI[o.refundStatus].label}</Pill>}
                  {o.paymentStatus !== "paid" && o.amount > 0 && (
                    <Link href={`/demo/pay/${o.id}`} className={`${btnSecondary} !py-1.5 text-xs`}>
                      <CreditCard className="h-3.5 w-3.5" /> To‘lash
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function Tile({ icon: Icon, label, value, tone = "text-brand-text" }: { icon: typeof Gift; label: string; value: string; tone?: string }) {
  return (
    <Card className="flex items-center gap-3 !py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
        <p className={`truncate text-base font-black ${tone}`}>{value}</p>
      </div>
    </Card>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-black text-brand-text">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Yopish" className="rounded-full border border-brand-border p-1.5 text-brand-muted hover:bg-brand-light">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function NewListingPanel({ state, userId, onClose, run, onCreated }: {
  state: DemoState; userId: string; onClose: () => void;
  run: ReturnType<typeof useDemo>["run"]; onCreated: (r: ActionResult) => void;
}) {
  const [input, setInput] = useState<ListingInput>(EMPTY_LISTING);
  const [plan, setPlan] = useState<ListingPlanId>("standard");
  const [promo, setPromo] = useState("");
  const q = listingQuote(state, userId, plan, promo);
  const monetized = state.settings.monetizationEnabled;
  const free = hasFreeRight(state, userId);

  return (
    <Card className="border-brand-primary/40 ring-4 ring-brand-primary/5">
      <PanelHeader title="Yangi e’lon" onClose={onClose} />
      <ListingFields value={input} onChange={setInput} />
      <div className="mt-5 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Tarifni tanlang</p>
        {!monetized ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">Admin monetizatsiyani o‘chirgan: barcha e’lonlar bepul.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["standard", "premium"] as ListingPlanId[]).map((id) => {
              const p = state.settings.plans[id];
              const isFree = id === "standard" && free;
              const selected = plan === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlan(id)}
                  aria-pressed={selected}
                  className={`rounded-2xl border-2 p-4 text-left transition ${selected ? "border-brand-primary bg-brand-light/60" : "border-brand-border bg-white hover:border-brand-border-dark"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-brand-text">{p.nameUz}</span>
                    {id === "premium" && <Pill tone="indigo"><Sparkles className="h-3 w-3" /> TOP {p.bonusTopDays} kun</Pill>}
                  </div>
                  <p className="mt-1 text-lg font-black text-brand-primary">
                    {isFree ? <>Bepul <span className="text-xs font-bold text-brand-muted line-through">{formatSum(p.price)}</span></> : formatSum(p.price)}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {id === "standard"
                      ? isFree ? "Birinchi e’lon — bepul" : "Oddiy e’lon, moderatsiyadan keyin saytda"
                      : `E’lon + TOP status ${p.bonusTopDays} kun (tasdiqlangan paytdan)`}
                  </p>
                </button>
              );
            })}
          </div>
        )}
        {monetized && !q.free && <PromoInput value={promo} onApply={setPromo} error={q.promoError} appliedCode={q.promo?.code ?? null} />}
        <PriceBreakdown q={q} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Bekor qilish</button>
          <button
            type="button"
            className={btnPrimary}
            disabled={Boolean(q.promoError)}
            onClick={() => {
              const r = run((s) => createListing(s, userId, input, plan, promo));
              if (r.ok) onCreated(r);
            }}
          >
            {q.free ? "Bepul joylash" : q.total === 0 ? "Yuborish (100% chegirma)" : <>To‘lovga o‘tish — {formatSum(q.total)}</>}
          </button>
        </div>
      </div>
    </Card>
  );
}

function RevisePanel({ listing, onClose, onSubmit }: { listing: Listing; onClose: () => void; onSubmit: (input: ListingInput) => void }) {
  const [input, setInput] = useState<ListingInput>({
    title: listing.title, dealType: listing.dealType, propertyType: listing.propertyType, price: listing.price, currency: listing.currency,
    rooms: listing.rooms, area: listing.area, location: listing.location, description: listing.description, phone: listing.phone, photos: listing.photos,
  });
  return (
    <Card className="border-orange-300 ring-4 ring-orange-100">
      <PanelHeader title="E’lonni tuzatish" onClose={onClose} />
      <p className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-sm text-orange-800">
        <b>Admin izohi:</b> {listing.revisionNote}
      </p>
      <ListingFields value={input} onChange={setInput} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onClose}>Bekor qilish</button>
        <button type="button" className={btnPrimary} onClick={() => onSubmit(input)}>Qayta moderatsiyaga yuborish</button>
      </div>
    </Card>
  );
}

function StatusPanel({ state, listing, onClose, onBuy }: {
  state: DemoState; listing: Listing; onClose: () => void; onBuy: (type: StatusType, days: StatusDays, promo: string) => void;
}) {
  const [type, setType] = useState<StatusType>("top");
  const [days, setDays] = useState<StatusDays>(7);
  const [promo, setPromo] = useState("");
  const q = statusQuote(state, type, days, promo);
  return (
    <Card className="border-indigo-300 ring-4 ring-indigo-50">
      <PanelHeader title={`Status sotib olish — ${listing.title}`} onClose={onClose} />
      <p className="mb-3 text-xs text-brand-muted">To‘lovdan keyin status admin tasdig‘ini kutadi. Muddat admin tasdiqlagan paytdan boshlab hisoblanadi.</p>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-muted">Status</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TYPES.map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
            className={`rounded-xl border-2 px-3.5 py-2 text-sm font-black transition ${type === t ? "border-brand-primary bg-brand-light/60 text-brand-primary" : "border-brand-border text-brand-text hover:border-brand-border-dark"}`}>
            {STATUS_NAMES[t].uz}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-muted">Muddat (tarif)</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {STATUS_DAYS.map((d) => (
          <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
            className={`rounded-2xl border-2 p-3 text-left transition ${days === d ? "border-brand-primary bg-brand-light/60" : "border-brand-border hover:border-brand-border-dark"}`}>
            <span className="block text-sm font-black text-brand-text">{d} kun</span>
            <span className="block text-xs font-bold text-brand-primary">{formatSum(state.settings.statusPrices[type][d])}</span>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <PromoInput value={promo} onApply={setPromo} error={q.promoError} appliedCode={q.promo?.code ?? null} />
        <PriceBreakdown q={q} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Bekor qilish</button>
          <button type="button" className={btnPrimary} disabled={Boolean(q.promoError)} onClick={() => onBuy(type, days, promo)}>
            {q.total === 0 ? "Yuborish (100% chegirma)" : <>To‘lovga o‘tish — {formatSum(q.total)}</>}
          </button>
        </div>
      </div>
    </Card>
  );
}

function ListingRow({ state, listing: l, onPay, onRevise, onStatus }: {
  state: DemoState; listing: Listing; onPay: (orderId: string) => void; onRevise: () => void; onStatus: () => void;
}) {
  const order = l.orderId ? state.orders.find((o) => o.id === l.orderId) : null;
  const pay = l.billing === "free" ? PAYMENT_UI.free : order ? PAYMENT_UI[order.paymentStatus] : null;
  const mod = MODERATION_UI[l.moderation];
  const statuses = state.statusOrders.filter((x) => x.listingId === l.id);
  const canPay = order && order.paymentStatus !== "paid" && order.amount > 0 && l.moderation === "not_submitted";

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl border border-brand-border sm:h-24 sm:w-32">
          <ListingThumb photos={l.photos} title={l.title} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-brand-text sm:text-base">{l.title}</h3>
              <p className="text-xs text-brand-muted">
                {l.location} · {l.price.toLocaleString("ru-RU")} {l.currency === "USD" ? "$" : "so‘m"} · {state.settings.plans[l.plan]?.nameUz ?? l.plan}
              </p>
            </div>
            <p className="text-[11px] text-brand-subtle">{fmtDate(l.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-brand-muted">To‘lov:</span>
            {pay && <Pill tone={pay.tone}>{pay.label}</Pill>}
            {order && order.amount > 0 && <span className="text-[11px] font-bold text-brand-text">{formatSum(order.amount)}</span>}
            <span className="ml-1 text-[11px] font-bold text-brand-muted">Moderatsiya:</span>
            <Pill tone={mod.tone}>{mod.label}</Pill>
            {order && order.refundStatus !== "none" && <Pill tone={REFUND_UI[order.refundStatus].tone}>{REFUND_UI[order.refundStatus].label}</Pill>}
          </div>
          {l.moderation === "rejected" && l.rejectReason && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <b>Rad etish sababi:</b> {l.rejectReason}
              {l.billing === "free" && <> · Bepul e’lon huquqingiz qaytarildi.</>}
              {l.billing === "paid" && order?.refundStatus === "requested" && <> · To‘langan summa qaytarilishi admin tomonidan ko‘rib chiqilmoqda.</>}
            </p>
          )}
          {l.moderation === "revision" && l.revisionNote && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800"><b>Tuzatish kerak:</b> {l.revisionNote}</p>
          )}
          {statuses.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-brand-canvas p-2.5">
              {statuses.map((so) => {
                const ph = statusPhase(state, so);
                const ui = STATUS_PHASE_UI[ph];
                return (
                  <div key={so.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <Pill tone="indigo">{STATUS_NAMES[so.type].uz}</Pill>
                    <span className="font-bold text-brand-text">{so.days} kun{so.source === "premium_bonus" ? " (Premium bonus)" : ""}</span>
                    <Pill tone={ui.tone}>{ui.label}</Pill>
                    {so.startsAt ? (
                      <span className="text-brand-muted">
                        {fmtDate(so.startsAt)} → {fmtDate(so.endsAt)}{ph === "active" ? ` · ${timeLeft(state, so.endsAt)}` : ""}
                      </span>
                    ) : ph === "pending_approval" || ph === "awaiting_payment" ? (
                      <span className="text-brand-muted">muddat admin tasdiqlagach boshlanadi</span>
                    ) : null}
                    {so.rejectReason && <span className="text-rose-700">Sabab: {so.rejectReason}</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {canPay && (
              <button type="button" className={`${btnPrimary} !py-1.5 text-xs`} onClick={() => onPay(order!.id)}>
                <CreditCard className="h-3.5 w-3.5" /> {order!.paymentStatus === "pending" ? "To‘lash" : "Qayta to‘lash"} — {formatSum(order!.amount)}
              </button>
            )}
            {l.moderation === "revision" && (
              <button type="button" className={`${btnPrimary} !py-1.5 text-xs`} onClick={onRevise}>
                <Pencil className="h-3.5 w-3.5" /> Tuzatish
              </button>
            )}
            {l.moderation === "approved" && (
              <>
                <button type="button" className={`${btnSecondary} !py-1.5 text-xs`} onClick={onStatus}>
                  <Sparkles className="h-3.5 w-3.5" /> Status sotib olish
                </button>
                <Link href={`/demo/elonlar#${l.id}`} className={`${btnSecondary} !py-1.5 text-xs`}>
                  <Eye className="h-3.5 w-3.5" /> Saytda ko‘rish
                </Link>
              </>
            )}
          </div>
          <details className="text-xs text-brand-muted">
            <summary className="inline-flex cursor-pointer items-center gap-1 font-bold hover:text-brand-text"><History className="h-3.5 w-3.5" /> Tarix</summary>
            <ul className="mt-1.5 space-y-0.5 pl-1">
              {l.history.map((h, i) => (
                <li key={i}>{fmtDate(h.at)} — {h.text}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </Card>
  );
}
