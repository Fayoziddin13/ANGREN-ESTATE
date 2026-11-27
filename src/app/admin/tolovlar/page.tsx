"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Eye, FileText, Loader2, MessageSquare, RefreshCw, Save, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ORDER_LABELS, REFUND_LABELS, StatusPill, formatDate, formatSum, type Locale } from "@/lib/monetization/client";

/**
 * Admin "Payments": manual card-to-card payments. The admin sees the receipt,
 * checks the money in the bank independently, then approves or rejects. An
 * approved listing goes to moderation, never straight to the site.
 * Also: the card customers pay to, and the Premium tariff.
 */

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/admin/monetization/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success !== false, data: json.data, message: json.message?.uz || json.detail || json.error };
}

const FILTERS = ["review", "waiting", "paid", "closed", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminPaymentsPage() {
  const { locale: raw } = useLanguage();
  const locale: Locale = raw === "ru" ? "ru" : "uz";
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const [filter, setFilter] = useState<Filter>("review");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`payments?filter=${filter}`);
    if (r.ok) setRows(r.data || []);
    else setErr(r.message || "error");
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const labels: Record<Filter, string> = {
    review: t("Tekshirish kerak", "На проверку"),
    waiting: t("To‘lov kutilmoqda", "Ожидают оплаты"),
    paid: t("To‘langan", "Оплачены"),
    closed: t("Bekor / muddati o‘tgan", "Отменены"),
    all: t("Hammasi", "Все"),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dee8e3] bg-[#eaf5f0]/60 text-[#167d4f]">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">{t("To‘lovlar (kartaga o‘tkazma)", "Платежи (перевод на карту)")}</h1>
            <p className="text-xs text-slate-500">{t("Chekni ko‘ring, bank tushumini mustaqil tekshiring, keyin tasdiqlang", "Проверьте чек и поступление в банке, затем подтвердите")}</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("Yangilash", "Обновить")}
        </button>
      </div>

      {msg && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">{msg}</div>}
      {err && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800">{err}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <CardSettings t={t} onMessage={(ok, m) => (ok ? (setMsg(m), setErr(null)) : (setErr(m), setMsg(null)))} />
        <PremiumSettings t={t} locale={locale} onMessage={(ok, m) => (ok ? (setMsg(m), setErr(null)) : (setErr(m), setMsg(null)))} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { setFilter(f); setOpen(null); }} aria-pressed={filter === f}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === f ? "border-[#167d4f] bg-[#eaf5f0] text-[#167d4f]" : "border-slate-200 bg-white text-slate-600"}`}>
            {labels[f]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {!loading && rows.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{t("Buyurtma yo‘q", "Заказов нет")}</p>}
        {rows.map((o) => (
          <div key={o.id} className="rounded-2xl border border-slate-200 bg-white">
            <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left" onClick={() => setOpen(open === o.id ? null : o.id)}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">
                  {o.service === "listing" ? (o.plan_snapshot?.listing_tier === "premium" ? "Premium e'lon" : t("Standart e'lon", "Стандарт")) : `${t("Stiker", "Стикер")} ${o.plan_snapshot?.sticker_type ?? ""} ${o.plan_snapshot?.duration_days ?? ""}${t(" kun", " дн.")}`}
                </span>
                <span className="block text-[11px] text-slate-500">{o.id} · {o.customer?.name || o.customer?.phone || o.customer?.email || "—"} · {formatDate(o.last_receipt_at || o.created_at, locale)}</span>
              </span>
              <span className="text-sm font-black text-slate-900">{formatSum(o.final_amount_uzs, locale)}</span>
              <StatusPill label={ORDER_LABELS[o.status]} locale={locale} />
              {o.refund_status && <StatusPill label={REFUND_LABELS[o.refund_status]} locale={locale} />}
              <span className="text-[11px] text-slate-400">{o.receipt_count} {t("chek", "чек.")}</span>
            </button>
            {open === o.id && (
              <PaymentDetail id={o.id} t={t} locale={locale} onDone={(m) => { setMsg(m); setErr(null); load(); }} onError={(m) => { setErr(m); setMsg(null); }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type T = (uz: string, ru: string) => string;

function PaymentDetail({ id, t, locale, onDone, onError }: { id: string; t: T; locale: Locale; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [mode, setMode] = useState<null | "reject" | "request_info">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api(`payments/${id}`);
    if (r.ok) setD(r.data);
    else onError(r.message || "error");
  }, [id, onError]);

  useEffect(() => {
    (async () => {
      const r = await api(`payments/${id}`);
      if (!r.ok) return onError(r.message || "error");
      setD(r.data);
      // Opening a submitted receipt takes it into review (recorded in the history).
      if (r.data?.order?.status === "RECEIPT_SUBMITTED") {
        await api(`payments/${id}/review`, { method: "POST", body: JSON.stringify({ action: "start" }) });
        const again = await api(`payments/${id}`);
        if (again.ok) setD(again.data);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function decide(action: "approve" | "reject" | "request_info") {
    if (action === "approve" && !window.confirm(t("Pul bank hisobiga tushganini tekshirdingizmi? Tasdiqlansinmi?", "Вы проверили поступление денег в банке? Подтвердить?"))) return;
    setBusy(true);
    const r = await api(`payments/${id}/review`, { method: "POST", body: JSON.stringify({ action, note: note || undefined }) });
    setBusy(false);
    if (!r.ok) return onError(r.message || "error");
    setMode(null);
    setNote("");
    await load();
    onDone(
      action === "approve"
        ? r.data?.target === "closed"
          ? t("To‘lov tasdiqlandi, lekin xizmat bekor qilingan edi — qaytarish so‘rovi ochildi", "Оплата подтверждена, но услуга была закрыта — открыт возврат")
          : t("To‘lov tasdiqlandi. E'lon moderatsiyaga o‘tdi (stiker — admin tasdig‘iga)", "Оплата подтверждена. Объявление ушло на модерацию (стикер — на одобрение)")
        : action === "reject"
          ? t("To‘lov rad etildi", "Оплата отклонена")
          : t("Qo‘shimcha ma’lumot so‘raldi", "Запрошены дополнительные данные")
    );
  }

  if (!d) return <div className="flex justify-center border-t border-slate-100 py-6"><Loader2 className="h-5 w-5 animate-spin text-[#167d4f]" /></div>;
  const o = d.order;
  const reviewable = o.status === "RECEIPT_SUBMITTED" || o.status === "UNDER_REVIEW";
  const ident = d.customer?.customer_identities?.[0];

  return (
    <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div><dt className="font-bold text-slate-500">{t("Buyurtma ID", "ID заказа")}</dt><dd className="break-all text-slate-800">{o.id}</dd></div>
        <div><dt className="font-bold text-slate-500">{t("Mijoz", "Клиент")}</dt><dd className="text-slate-800">{d.customer?.display_name || ident?.phone_e164 || ident?.email || "—"}{ident?.telegram_username ? ` @${ident.telegram_username}` : ""}</dd></div>
        <div><dt className="font-bold text-slate-500">{t("Yakuniy summa", "Итоговая сумма")}</dt><dd className="font-black text-slate-900">{formatSum(o.final_amount_uzs, locale)}</dd></div>
        <div><dt className="font-bold text-slate-500">{t("Holat", "Статус")}</dt><dd><StatusPill label={ORDER_LABELS[o.status]} locale={locale} /></dd></div>
        <div><dt className="font-bold text-slate-500">{t("Admin qarori", "Решение")}</dt><dd className="text-slate-800">{o.reviewed_by ? `${o.reviewed_by} · ${formatDate(o.reviewed_at, locale)}` : "—"}</dd></div>
        <div className="col-span-2"><dt className="font-bold text-slate-500">{t("Rad etish sababi / so‘rov", "Причина / запрос")}</dt><dd className="text-slate-800">{o.status_reason || "—"}</dd></div>
      </dl>

      {d.receipts.map((r: any, i: number) => (
        <div key={r.id} className={`space-y-2 rounded-xl border p-2.5 ${i === 0 ? "border-slate-300 bg-slate-50" : "border-slate-100"}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            <b className="text-slate-800">{r.mime === "application/pdf" ? "PDF" : r.mime === "image/png" ? "PNG" : "JPG"}</b>
            <span>{Math.ceil(r.size_bytes / 1024)} KB</span>
            <span>{formatDate(r.created_at, locale)}</span>
            <span>{t("holat", "статус")}: {r.state}</span>
            <span title={r.sha256}>SHA-256 {r.sha256.slice(0, 12)}…</span>
            <span>{t("karta", "карта")} •••• {r.card_snapshot?.last4}</span>
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#167d4f]"><Eye className="h-3.5 w-3.5" /> {t("Ochish", "Открыть")}</a>}
          </div>
          {r.note && <p className="text-xs text-slate-700">{t("Mijoz izohi", "Комментарий клиента")}: {r.note}</p>}
          {i === 0 && r.url && r.mime !== "application/pdf" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.url} alt={t("To‘lov cheki", "Чек оплаты")} className="max-h-96 rounded-lg border border-slate-200 bg-white" />
          )}
          {i === 0 && r.url && r.mime === "application/pdf" && (
            <iframe title={t("To‘lov cheki", "Чек оплаты")} src={r.url} className="h-96 w-full rounded-lg border border-slate-200 bg-white" />
          )}
        </div>
      ))}

      {reviewable && (mode ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder={mode === "reject" ? t("Rad etish sababi (mijozga ko‘rinadi)", "Причина отказа (видна клиенту)") : t("Qanday chek / ma’lumot kerak", "Какой чек / данные нужны")} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => decide(mode)} className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white ${mode === "reject" ? "bg-rose-600" : "bg-[#167d4f]"}`}>
              {mode === "reject" ? t("Rad etish", "Отклонить") : t("So‘rov yuborish", "Отправить запрос")}
            </button>
            <button onClick={() => { setMode(null); setNote(""); }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">{t("Bekor", "Отмена")}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy} onClick={() => decide("approve")} className="inline-flex items-center gap-1 rounded-xl bg-[#167d4f] px-3 py-1.5 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" /> {t("Tasdiqlash (pul tushdi)", "Подтвердить (деньги пришли)")}</button>
          <button onClick={() => setMode("reject")} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"><X className="h-3.5 w-3.5" /> {t("Rad etish", "Отклонить")}</button>
          <button onClick={() => setMode("request_info")} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"><MessageSquare className="h-3.5 w-3.5" /> {t("Qo‘shimcha chek/ma’lumot so‘rash", "Запросить чек/данные")}</button>
        </div>
      ))}

      {d.refunds.length > 0 && (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          {t("Qaytarish (to‘lovdan alohida)", "Возврат (отдельно от оплаты)")}: {d.refunds.map((f: any) => `${REFUND_LABELS[f.status]?.[locale] ?? f.status} · ${formatSum(f.amount_uzs, locale)} · ${f.reason}`).join("; ")}
          {" — "}{t("“Monetizatsiya → Qaytarishlar” bo‘limida bank raqami bilan tasdiqlanadi", "подтверждается в «Монетизация → Возвраты» с номером банка")}
        </p>
      )}

      {d.reviews.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-slate-500">
          {d.reviews.map((r: any) => <li key={r.id}>{formatDate(r.created_at, locale)} — {r.actor_id}: {r.decision}{r.note ? ` (${r.note})` : ""}</li>)}
        </ul>
      )}
    </div>
  );
}

function CardSettings({ t, onMessage }: { t: T; onMessage: (ok: boolean, m: string) => void }) {
  const [card, setCard] = useState({ card_number: "", holder_name: "", bank_name: "", instructions: "", accepting: true });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api("payment-method").then((r) => {
      if (r.ok && r.data) {
        setCard({
          card_number: String(r.data.card_number || "").replace(/(\d{4})(?=\d)/g, "$1 "),
          holder_name: r.data.holder_name || "",
          bank_name: r.data.bank_name || "",
          instructions: r.data.instructions || "",
          accepting: Boolean(r.data.accepting),
        });
      }
      setLoaded(true);
    });
  }, []);
  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#167d4f]";
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-black text-slate-900">{t("To‘lov kartasi", "Карта для оплаты")}</h2>
      {!loaded ? <Loader2 className="h-4 w-4 animate-spin text-[#167d4f]" /> : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="text-[11px] font-bold uppercase text-slate-500">{t("Karta raqami", "Номер карты")}
            <input className={`${input} mt-1 tracking-wider`} inputMode="numeric" value={card.card_number}
              onChange={(e) => setCard({ ...card, card_number: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ") })} />
          </label>
          <label className="text-[11px] font-bold uppercase text-slate-500">{t("Karta egasi", "Владелец")}
            <input className={`${input} mt-1`} value={card.holder_name} onChange={(e) => setCard({ ...card, holder_name: e.target.value })} />
          </label>
          <label className="text-[11px] font-bold uppercase text-slate-500">{t("Bank (ixtiyoriy)", "Банк (необязательно)")}
            <input className={`${input} mt-1`} value={card.bank_name} onChange={(e) => setCard({ ...card, bank_name: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={card.accepting} onChange={(e) => setCard({ ...card, accepting: e.target.checked })} />
            {t("To‘lov qabul qilinadi", "Оплата принимается")}
          </label>
          <label className="text-[11px] font-bold uppercase text-slate-500 sm:col-span-2">{t("Yo‘riqnoma", "Инструкция")}
            <textarea rows={2} className={`${input} mt-1`} value={card.instructions} onChange={(e) => setCard({ ...card, instructions: e.target.value })} />
          </label>
        </div>
      )}
      <button onClick={async () => {
        const r = await api("payment-method", { method: "POST", body: JSON.stringify(card) });
        onMessage(r.ok, r.ok ? t("Karta saqlandi", "Карта сохранена") : r.message || "error");
      }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#167d4f] px-3 py-2 text-xs font-bold text-white"><Save className="h-4 w-4" /> {t("Saqlash", "Сохранить")}</button>
      <p className="text-[11px] text-slate-400">{t("Karta almashtirilsa, eskisi tarixda saqlanadi; har bir chek qaysi kartaga yuborilganini eslab qoladi.", "При смене карты старая сохраняется в истории; каждый чек помнит, на какую карту он отправлен.")}</p>
    </section>
  );
}

function PremiumSettings({ t, locale, onMessage }: { t: T; locale: Locale; onMessage: (ok: boolean, m: string) => void }) {
  const [standard, setStandard] = useState("");
  const [premium, setPremium] = useState("");
  const [features, setFeatures] = useState("");
  useEffect(() => {
    api("prices").then((r) => {
      const active: any[] = r.data?.active || [];
      setStandard(String(active.find((p) => p.service === "listing" && p.listing_tier === "standard")?.price_uzs ?? ""));
      setPremium(String(active.find((p) => p.service === "listing" && p.listing_tier === "premium")?.price_uzs ?? ""));
    });
    api("settings").then((r) => setFeatures((r.data?.premium_features || []).join("\n")));
  }, []);
  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#167d4f]";
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-black text-slate-900">{t("E'lon tariflari", "Тарифы объявлений")}</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="text-[11px] font-bold uppercase text-slate-500">Standart ({formatSum(Number(standard) || 0, locale)})
          <input className={`${input} mt-1`} inputMode="numeric" value={standard} onChange={(e) => setStandard(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-[11px] font-bold uppercase text-slate-500">Premium ({formatSum(Number(premium) || 0, locale)})
          <input className={`${input} mt-1`} inputMode="numeric" value={premium} onChange={(e) => setPremium(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-[11px] font-bold uppercase text-slate-500 sm:col-span-2">{t("Premium imkoniyatlari (har qatorda bittasi; TOP kirmaydi)", "Возможности Premium (по одной в строке; без TOP)")}
          <textarea rows={3} className={`${input} mt-1`} value={features} onChange={(e) => setFeatures(e.target.value)} />
        </label>
      </div>
      <button onClick={async () => {
        const a = await api("prices", { method: "POST", body: JSON.stringify({ service: "listing", listing_tier: "standard", price_uzs: Number(standard) }) });
        const b = a.ok ? await api("prices", { method: "POST", body: JSON.stringify({ service: "listing", listing_tier: "premium", price_uzs: Number(premium) }) }) : a;
        const c = b.ok ? await api("settings", { method: "PATCH", body: JSON.stringify({ premium_features: features.split("\n") }) }) : b;
        onMessage(c.ok, c.ok ? t("Tariflar saqlandi", "Тарифы сохранены") : c.message || "error");
      }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#167d4f] px-3 py-2 text-xs font-bold text-white"><Save className="h-4 w-4" /> {t("Saqlash", "Сохранить")}</button>
    </section>
  );
}
