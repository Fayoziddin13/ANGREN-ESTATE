"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ORDER_LABELS, REFUND_LABELS, STICKER_LABELS, StatusPill, formatDate, formatSum, type Locale } from "@/lib/monetization/client";

/** Admin "Monetization" section: switches, prices, promo codes, promotions, payments, refunds, accounts, audit. */

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

const TABS = ["overview", "settings", "prices", "promo", "promotions", "orders", "refunds", "accounts", "audit"] as const;
type Tab = (typeof TABS)[number];

export default function MonetizationAdminPage() {
  const { locale: raw } = useLanguage();
  const locale: Locale = raw === "ru" ? "ru" : "uz";
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const labels: Record<Tab, string> = {
    overview: t("Umumiy", "Обзор"),
    settings: t("Sozlamalar", "Настройки"),
    prices: t("Tariflar", "Тарифы"),
    promo: t("Promokodlar", "Промокоды"),
    promotions: t("Aksiyalar", "Акции"),
    orders: t("To‘lovlar", "Платежи"),
    refunds: t("Qaytarishlar", "Возвраты"),
    accounts: t("Mijozlar", "Клиенты"),
    audit: t("Audit", "Аудит"),
  };

  const run = async (p: Promise<{ ok: boolean; message?: string }>, ok: string) => {
    setMsg(null);
    setErr(null);
    const r = await p;
    if (r.ok) setMsg(ok);
    else setErr(r.message || "error");
    setTick((x) => x + 1);
    return r.ok;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf5f0]/60 text-[#167d4f] border border-[#dee8e3]">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">{t("Monetizatsiya", "Монетизация")}</h1>
            <p className="text-xs text-slate-500">{t("Tariflar, to‘lovlar va qoidalar boshqaruvi", "Управление тарифами, платежами и правилами")}</p>
          </div>
        </div>
        <button onClick={() => setTick((x) => x + 1)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold">
          <RefreshCw className="h-4 w-4" /> {t("Yangilash", "Обновить")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((k) => (
          <button key={k} data-testid={`mon-tab-${k}`} onClick={() => { setTab(k); setMsg(null); setErr(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${tab === k ? "bg-[#167d4f] text-white border-[#167d4f]" : "bg-white border-slate-200 text-slate-600"}`}>
            {labels[k]}
          </button>
        ))}
      </div>
      {msg && <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">{msg}</p>}
      {err && <p className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{err}</p>}
      <div className="rounded-3xl bg-white border border-slate-200 p-5">
        {tab === "overview" && <Overview key={tick} locale={locale} />}
        {tab === "settings" && <Settings key={tick} locale={locale} run={run} />}
        {tab === "prices" && <Prices key={tick} locale={locale} run={run} />}
        {tab === "promo" && <Promo key={tick} locale={locale} run={run} />}
        {tab === "promotions" && <Promotions key={tick} locale={locale} run={run} />}
        {tab === "orders" && <Orders key={tick} locale={locale} run={run} />}
        {tab === "refunds" && <Refunds key={tick} locale={locale} run={run} />}
        {tab === "accounts" && <Accounts key={tick} locale={locale} run={run} />}
        {tab === "audit" && <Audit key={tick} locale={locale} />}
      </div>
    </div>
  );
}

type Run = (p: Promise<{ ok: boolean; message?: string }>, ok: string) => Promise<boolean>;

function useData(path: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api(path);
    if (r.ok) setData(r.data);
    else setError(r.message || "error");
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, reload: load };
}

const inputCls = "rounded-xl border border-slate-200 px-3 py-2 text-sm";
const btn = "px-3 py-2 rounded-xl text-xs font-bold";

function Overview({ locale }: { locale: Locale }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, error } = useData("stats");
  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!data) return <p className="text-xs text-slate-500">…</p>;
  const periods: Array<[string, any]> = [
    [t("Bugun", "Сегодня"), data.revenue.today],
    [t("7 kun", "7 дней"), data.revenue.last_7_days],
    [t("30 kun", "30 дней"), data.revenue.last_30_days],
    [t("Jami", "Всего"), data.revenue.all_time],
  ];
  const counts: Array<[string, number]> = [
    [t("Moderatsiyada", "На модерации"), data.counts.pending_review],
    [t("To‘lov kutmoqda", "Ждут оплаты"), data.counts.awaiting_payment],
    [t("Tuzatishda", "На исправлении"), data.counts.revision_required],
    [t("Stiker so‘rovlari", "Запросы стикеров"), data.counts.stickers_pending],
    [t("Faol stikerlar", "Активные стикеры"), data.counts.stickers_running],
    [t("Ochiq qaytarishlar", "Открытые возвраты"), data.counts.refunds_open + data.counts.refunds_manual],
  ];
  return (
    <div className="space-y-5" data-testid="mon-overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {periods.map(([name, p]) => (
          <div key={name} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-bold text-slate-500">{name}</p>
            <p className="text-lg font-black text-slate-900">{formatSum(p.net, locale)}</p>
            <p className="text-[11px] text-slate-500">{t("Tushum", "Выручка")} {formatSum(p.gross, locale)} · {t("qaytarildi", "возвращено")} {formatSum(p.refunded, locale)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {counts.map(([name, n]) => (
          <div key={name} className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{name}</p>
            <p className="text-xl font-black">{n}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {t("E'lonlardan", "С объявлений")}: <b>{formatSum(data.revenue.by_service.listing, locale)}</b> · {t("Stikerlardan", "Со стикеров")}: <b>{formatSum(data.revenue.by_service.sticker, locale)}</b>
      </p>
    </div>
  );
}

function Settings({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, reload } = useData("settings");
  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (!form) return <p className="text-xs text-slate-500">…</p>;
  const toggles: Array<[string, string]> = [
    ["enabled", t("Monetizatsiya yoqilgan (asosiy kalit)", "Монетизация включена (главный выключатель)")],
    ["listing_payment_enabled", t("E'lon joylashtirish pullik", "Размещение объявления платное")],
    ["sticker_payment_enabled", t("Stikerlar pullik", "Стикеры платные")],
    ["free_first_listing_enabled", t("Birinchi e'lon bepul", "Первое объявление бесплатно")],
  ];
  const numbers: Array<[string, string]> = [
    ["free_listing_limit", t("Bepul e'lonlar soni (har bir hisobga)", "Бесплатных объявлений на аккаунт")],
    ["free_submissions_per_30_days", t("30 kunda bepul arizalar limiti", "Лимит бесплатных заявок за 30 дней")],
    ["order_ttl_minutes", t("To‘lov muddati (daqiqa)", "Срок оплаты (минут)")],
    ["revision_attempts", t("Tuzatish urinishlari", "Попыток исправления")],
  ];
  return (
    <div className="space-y-4 max-w-xl" data-testid="mon-settings">
      {toggles.map(([k, label]) => (
        <label key={k} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
          <span className="text-sm font-bold text-slate-800">{label}</span>
          <input data-testid={`setting-${k}`} type="checkbox" className="h-5 w-5 accent-[#167d4f]" checked={Boolean(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
        </label>
      ))}
      {numbers.map(([k, label]) => (
        <label key={k} className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-700">{label}</span>
          <input type="number" className={`${inputCls} w-28`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
        </label>
      ))}
      <p className="text-[11px] text-slate-500">
        {t("O‘chirish faqat yangi buyurtmalarni to‘xtatadi: to‘langan buyurtmalar, faol stikerlar va e'lonlar saqlanadi.",
          "Выключение останавливает только новые заказы: оплаченные заказы, активные стикеры и объявления сохраняются.")}
      </p>
      <button data-testid="settings-save" className={`${btn} bg-[#167d4f] text-white`} onClick={async () => {
        const { enabled, listing_payment_enabled, sticker_payment_enabled, free_first_listing_enabled, free_listing_limit,
          free_submissions_per_30_days, order_ttl_minutes, revision_attempts } = form;
        await run(api("settings", { method: "PATCH", body: JSON.stringify({ enabled, listing_payment_enabled, sticker_payment_enabled,
          free_first_listing_enabled, free_listing_limit, free_submissions_per_30_days, order_ttl_minutes, revision_attempts }) }),
          t("Sozlamalar saqlandi", "Настройки сохранены"));
        reload();
      }}>{t("Saqlash", "Сохранить")}</button>
    </div>
  );
}

function Prices({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, reload } = useData("prices");
  const [listing, setListing] = useState("");
  const [sticker, setSticker] = useState({ sticker_type: "top", duration_days: "7", price_uzs: "" });
  if (!data) return <p className="text-xs text-slate-500">…</p>;
  const active: any[] = data.active;
  const listingPlan = active.find((p) => p.service === "listing");
  return (
    <div className="space-y-6" data-testid="mon-prices">
      <div className="space-y-2">
        <p className="text-sm font-black">{t("E'lon joylashtirish narxi", "Цена размещения объявления")}</p>
        <p className="text-xs text-slate-500">{t("Hozirgi", "Текущая")}: <b>{listingPlan ? formatSum(listingPlan.price_uzs, locale) : t("belgilanmagan", "не задана")}</b></p>
        <div className="flex gap-2">
          <input data-testid="price-listing" className={inputCls} type="number" placeholder="50000" value={listing} onChange={(e) => setListing(e.target.value)} />
          <button data-testid="price-listing-save" className={`${btn} bg-[#167d4f] text-white`} onClick={async () => {
            if (await run(api("prices", { method: "POST", body: JSON.stringify({ service: "listing", price_uzs: Number(listing) }) }), t("Narx saqlandi", "Цена сохранена"))) setListing("");
            reload();
          }}>{t("O‘rnatish", "Установить")}</button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-black">{t("Stiker narxlari (har bir muddat alohida)", "Цены стикеров (по каждому сроку)")}</p>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-500"><th>{t("Stiker", "Стикер")}</th><th>{t("Muddat", "Срок")}</th><th>{t("Narx", "Цена")}</th><th /></tr></thead>
          <tbody>
            {active.filter((p) => p.service === "sticker").map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-1.5 font-bold">{STICKER_LABELS[p.sticker_type]?.[locale]}</td>
                <td>{p.duration_days} {t("kun", "дн.")}</td>
                <td>{formatSum(p.price_uzs, locale)}</td>
                <td><button className="text-rose-600 font-bold" onClick={async () => { await run(api(`prices/${p.id}/deactivate`, { method: "POST", body: "{}" }), t("O‘chirildi", "Отключено")); reload(); }}>{t("O‘chirish", "Отключить")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <select data-testid="price-sticker-type" className={inputCls} value={sticker.sticker_type} onChange={(e) => setSticker({ ...sticker, sticker_type: e.target.value })}>
            {Object.keys(STICKER_LABELS).map((s) => <option key={s} value={s}>{STICKER_LABELS[s][locale]}</option>)}
          </select>
          <input data-testid="price-sticker-days" className={`${inputCls} w-24`} type="number" value={sticker.duration_days} onChange={(e) => setSticker({ ...sticker, duration_days: e.target.value })} placeholder={t("kun", "дней")} />
          <input data-testid="price-sticker-amount" className={inputCls} type="number" value={sticker.price_uzs} onChange={(e) => setSticker({ ...sticker, price_uzs: e.target.value })} placeholder="20000" />
          <button data-testid="price-sticker-save" className={`${btn} bg-[#167d4f] text-white`} onClick={async () => {
            await run(api("prices", { method: "POST", body: JSON.stringify({ service: "sticker", sticker_type: sticker.sticker_type, duration_days: Number(sticker.duration_days), price_uzs: Number(sticker.price_uzs) }) }), t("Narx saqlandi", "Цена сохранена"));
            reload();
          }}>{t("O‘rnatish", "Установить")}</button>
        </div>
        <p className="text-[11px] text-slate-500">{t("Yangi narx faqat yangi buyurtmalarga ta’sir qiladi; eski buyurtmalar o‘z narxini saqlaydi.", "Новая цена влияет только на новые заказы.")}</p>
      </div>
      {data.history?.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-bold">{t("Narxlar tarixi", "История цен")}</summary>
          {data.history.map((p: any) => <p key={p.id}>{formatDate(p.created_at, locale)} · {p.service} {p.sticker_type || ""} {p.duration_days || ""} · {formatSum(p.price_uzs, locale)}</p>)}
        </details>
      )}
    </div>
  );
}

function Promo({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, reload } = useData("promo-codes");
  const [f, setF] = useState<any>({ code: "", discount_type: "percent", discount_value: "10", max_uses: "", per_account_limit: "1", min_order_uzs: "", ends_at: "", listing: true, sticker: true });
  return (
    <div className="space-y-4" data-testid="mon-promo">
      <div className="flex flex-wrap gap-2 items-end">
        <input data-testid="promo-code" className={inputCls} placeholder="CODE10" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        <select className={inputCls} value={f.discount_type} onChange={(e) => setF({ ...f, discount_type: e.target.value })}>
          <option value="percent">%</option><option value="fixed">{t("so‘m", "сум")}</option>
        </select>
        <input data-testid="promo-value" className={`${inputCls} w-24`} type="number" value={f.discount_value} onChange={(e) => setF({ ...f, discount_value: e.target.value })} />
        <input className={`${inputCls} w-28`} type="number" placeholder={t("Jami limit", "Лимит всего")} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} />
        <input className={`${inputCls} w-28`} type="number" placeholder={t("1 kishiga", "На 1 клиента")} value={f.per_account_limit} onChange={(e) => setF({ ...f, per_account_limit: e.target.value })} />
        <input className={`${inputCls} w-32`} type="number" placeholder={t("Min. summa", "Мин. сумма")} value={f.min_order_uzs} onChange={(e) => setF({ ...f, min_order_uzs: e.target.value })} />
        <input className={inputCls} type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.listing} onChange={(e) => setF({ ...f, listing: e.target.checked })} />{t("E'lon", "Объявление")}</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.sticker} onChange={(e) => setF({ ...f, sticker: e.target.checked })} />{t("Stiker", "Стикер")}</label>
        <button data-testid="promo-create" className={`${btn} bg-[#167d4f] text-white`} onClick={async () => {
          const ok = await run(api("promo-codes", { method: "POST", body: JSON.stringify({
            code: f.code, discount_type: f.discount_type, discount_value: Number(f.discount_value),
            max_uses: f.max_uses ? Number(f.max_uses) : null, per_account_limit: Number(f.per_account_limit || 1),
            min_order_uzs: f.min_order_uzs ? Number(f.min_order_uzs) : 0, ends_at: f.ends_at || null,
            services: [f.listing && "listing", f.sticker && "sticker"].filter(Boolean),
          }) }), t("Promokod yaratildi", "Промокод создан"));
          if (ok) setF({ ...f, code: "" });
          reload();
        }}>{t("Yaratish", "Создать")}</button>
      </div>
      <p className="text-[11px] text-slate-500">{t("Foiz 1–99% (100% mumkin emas). Promokod va aksiya qo‘shilmaydi — kattasi qo‘llanadi.", "Процент 1–99%. Промокод и акция не суммируются — применяется большая скидка.")}</p>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-slate-500"><th>{t("Kod", "Код")}</th><th>{t("Chegirma", "Скидка")}</th><th>{t("Ishlatilgan", "Использовано")}</th><th>{t("Muddat", "Срок")}</th><th>{t("Holat", "Статус")}</th><th /></tr></thead>
        <tbody>
          {(data || []).map((p: any) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-1.5 font-black">{p.code}</td>
              <td>{p.discount_type === "percent" ? `${p.discount_value}%` : formatSum(p.discount_value, locale)} · {p.services.join(", ")}</td>
              <td>{p.uses_consumed}{p.uses_reserved ? ` (+${p.uses_reserved})` : ""}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
              <td>{p.ends_at ? formatDate(p.ends_at, locale) : "∞"}</td>
              <td>{p.is_active ? t("Faol", "Активен") : t("O‘chiq", "Выключен")}</td>
              <td className="space-x-2">
                <button className="font-bold text-[#167d4f]" onClick={async () => { await run(api(`promo-codes/${p.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !p.is_active }) }), "OK"); reload(); }}>
                  {p.is_active ? t("O‘chirish", "Выключить") : t("Yoqish", "Включить")}
                </button>
                <button className="font-bold text-rose-600" onClick={async () => { await run(api(`promo-codes/${p.id}`, { method: "DELETE" }), "OK"); reload(); }}>{t("Ochirish", "Удалить")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Promotions({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, reload } = useData("promotions");
  const [f, setF] = useState<any>({ name: "", discount_type: "percent", discount_value: "20", starts_at: "", ends_at: "", listing: true, sticker: false });
  return (
    <div className="space-y-4" data-testid="mon-promotions">
      <div className="flex flex-wrap gap-2 items-end">
        <input data-testid="promotion-name" className={inputCls} placeholder={t("Aksiya nomi", "Название")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className={inputCls} value={f.discount_type} onChange={(e) => setF({ ...f, discount_type: e.target.value })}>
          <option value="percent">%</option><option value="fixed">{t("so‘m", "сум")}</option>
        </select>
        <input className={`${inputCls} w-24`} type="number" value={f.discount_value} onChange={(e) => setF({ ...f, discount_value: e.target.value })} />
        <input data-testid="promotion-start" className={inputCls} type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
        <input data-testid="promotion-end" className={inputCls} type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.listing} onChange={(e) => setF({ ...f, listing: e.target.checked })} />{t("E'lon", "Объявление")}</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.sticker} onChange={(e) => setF({ ...f, sticker: e.target.checked })} />{t("Stiker", "Стикер")}</label>
        <button data-testid="promotion-create" className={`${btn} bg-[#167d4f] text-white`} onClick={async () => {
          await run(api("promotions", { method: "POST", body: JSON.stringify({
            name: f.name, discount_type: f.discount_type, discount_value: Number(f.discount_value),
            starts_at: f.starts_at, ends_at: f.ends_at, services: [f.listing && "listing", f.sticker && "sticker"].filter(Boolean),
          }) }), t("Aksiya yaratildi", "Акция создана"));
          reload();
        }}>{t("Yaratish", "Создать")}</button>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-slate-500"><th>{t("Nomi", "Название")}</th><th>{t("Chegirma", "Скидка")}</th><th>{t("Davr", "Период")}</th><th>{t("Holat", "Статус")}</th><th /></tr></thead>
        <tbody>
          {(data || []).map((p: any) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-1.5 font-bold">{p.name}</td>
              <td>{p.discount_type === "percent" ? `${p.discount_value}%` : formatSum(p.discount_value, locale)} · {p.services.join(", ")}</td>
              <td>{formatDate(p.starts_at, locale)} → {formatDate(p.ends_at, locale)}</td>
              <td>{p.is_active ? t("Faol", "Активна") : t("O‘chiq", "Выключена")}</td>
              <td className="space-x-2">
                <button className="font-bold text-[#167d4f]" onClick={async () => { await run(api(`promotions/${p.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !p.is_active }) }), "OK"); reload(); }}>
                  {p.is_active ? t("O‘chirish", "Выключить") : t("Yoqish", "Включить")}
                </button>
                <button className="font-bold text-rose-600" onClick={async () => { await run(api(`promotions/${p.id}`, { method: "DELETE" }), "OK"); reload(); }}>{t("Ochirish", "Удалить")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Orders({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const [status, setStatus] = useState("all");
  const { data, reload } = useData(`orders?status=${status}`);
  return (
    <div className="space-y-3" data-testid="mon-orders">
      <div className="flex gap-1.5 flex-wrap">
        {["all", "PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${status === s ? "bg-slate-900 text-white" : "bg-white border-slate-200"}`}>
            {s === "all" ? t("Hammasi", "Все") : ORDER_LABELS[s][locale]}
          </button>
        ))}
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-slate-500"><th>{t("Sana", "Дата")}</th><th>{t("Xizmat", "Услуга")}</th><th>{t("Mijoz", "Клиент")}</th><th>{t("Summa", "Сумма")}</th><th>{t("Holat", "Статус")}</th><th /></tr></thead>
        <tbody>
          {(data || []).map((o: any) => (
            <tr key={o.id} className="border-t border-slate-100">
              <td className="py-1.5">{formatDate(o.created_at, locale)}</td>
              <td>{o.service === "listing" ? t("E'lon", "Объявление") : `${STICKER_LABELS[o.plan_snapshot?.sticker_type]?.[locale] || ""} ${o.plan_snapshot?.duration_days || ""}`}</td>
              <td>{o.customer_accounts?.display_name || o.account_id.slice(0, 8)}</td>
              <td>{formatSum(o.final_amount_uzs, locale)}{o.discount_uzs > 0 && <span className="text-emerald-700"> (−{formatSum(o.discount_uzs, locale)})</span>}</td>
              <td><StatusPill label={ORDER_LABELS[o.status]} locale={locale} /> <span className="text-slate-400">{o.provider || ""}</span></td>
              <td>
                {o.status === "PAID" && (
                  <button className="font-bold text-rose-600" onClick={async () => {
                    const reason = window.prompt(t("Pulni qaytarish sababi (istisno):", "Причина возврата (исключение):"));
                    if (!reason) return;
                    await run(api(`orders/${o.id}/refund`, { method: "POST", body: JSON.stringify({ note: reason }) }), t("Qaytarish boshlandi", "Возврат запущен"));
                    reload();
                  }}>{t("Pulni qaytarish", "Вернуть")}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Refunds({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, reload } = useData("refunds");
  return (
    <table className="w-full text-xs" data-testid="mon-refunds">
      <thead><tr className="text-left text-slate-500"><th>{t("Sana", "Дата")}</th><th>{t("Summa", "Сумма")}</th><th>{t("Sabab", "Причина")}</th><th>{t("Holat", "Статус")}</th><th>{t("Raqam", "Номер")}</th><th /></tr></thead>
      <tbody>
        {(data || []).map((r: any) => (
          <tr key={r.id} className="border-t border-slate-100">
            <td className="py-1.5">{formatDate(r.created_at, locale)}</td>
            <td>{formatSum(r.amount_uzs, locale)}</td>
            <td className="max-w-xs truncate">{r.reason}</td>
            <td><StatusPill label={REFUND_LABELS[r.status]} locale={locale} /></td>
            <td>{r.provider_ref || "—"}</td>
            <td className="space-x-2">
              {r.status === "MANUAL_REQUIRED" && (
                <button className="font-bold text-[#167d4f]" onClick={async () => {
                  const ref = window.prompt(t("To‘lov tizimidagi qaytarish raqami:", "Номер возврата в платёжной системе:"));
                  if (!ref) return;
                  await run(api(`refunds/${r.id}/confirm`, { method: "POST", body: JSON.stringify({ provider_ref: ref }) }), t("Qaytarish tasdiqlandi", "Возврат подтверждён"));
                  reload();
                }}>{t("Qo‘lda qaytarildi", "Возвращено вручную")}</button>
              )}
              {r.status === "FAILED" && (
                <button className="font-bold text-[#167d4f]" onClick={async () => { await run(api(`refunds/${r.id}/retry`, { method: "POST", body: "{}" }), t("Qayta urinildi", "Повторено")); reload(); }}>
                  {t("Qayta urinish", "Повторить")}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Accounts({ locale, run }: { locale: Locale; run: Run }) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const { data, reload } = useData("accounts");
  return (
    <table className="w-full text-xs" data-testid="mon-accounts">
      <thead><tr className="text-left text-slate-500"><th>{t("Mijoz", "Клиент")}</th><th>{t("Kirish usullari", "Способы входа")}</th><th>{t("Arizalar", "Заявки")}</th><th>{t("Holat", "Статус")}</th><th /></tr></thead>
      <tbody>
        {(data || []).map((a: any) => (
          <tr key={a.id} className="border-t border-slate-100">
            <td className="py-1.5 font-bold">{a.display_name || a.id.slice(0, 8)}</td>
            <td>{a.customer_identities.map((i: any) => `${i.provider}${i.phone_e164 ? ` ${i.phone_e164}${i.phone_verified ? "✓" : ""}` : ""}${i.email ? ` ${i.email}` : ""}`).join(" · ")}</td>
            <td>{a.submissions_total} ({t("bepul", "беспл.")} {a.submissions_free}, {t("tasdiqlangan", "одобр.")} {a.submissions_approved})</td>
            <td className={a.status === "blocked" ? "text-rose-600 font-bold" : ""}>{a.status === "blocked" ? `${t("Bloklangan", "Заблокирован")}: ${a.status_reason || ""}` : t("Faol", "Активен")}</td>
            <td>
              {a.status === "active" ? (
                <button className="font-bold text-rose-600" onClick={async () => {
                  const reason = window.prompt(t("Bloklash sababi:", "Причина блокировки:"));
                  if (!reason) return;
                  await run(api(`accounts/${a.id}/block`, { method: "POST", body: JSON.stringify({ note: reason }) }), t("Bloklandi", "Заблокирован"));
                  reload();
                }}>{t("Bloklash", "Заблокировать")}</button>
              ) : (
                <button className="font-bold text-[#167d4f]" onClick={async () => { await run(api(`accounts/${a.id}/unblock`, { method: "POST", body: "{}" }), t("Blokdan chiqarildi", "Разблокирован")); reload(); }}>
                  {t("Blokdan chiqarish", "Разблокировать")}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Audit({ locale }: { locale: Locale }) {
  const { data } = useData("audit");
  return (
    <div className="space-y-1 text-[11px] text-slate-600 font-mono" data-testid="mon-audit">
      {(data || []).map((a: any) => (
        <p key={a.id}>
          {formatDate(a.created_at, locale)} · {a.actor_type}:{a.actor_id ? String(a.actor_id).slice(0, 12) : "—"} · <b>{a.action}</b> · {a.entity}:{a.entity_id ? String(a.entity_id).slice(0, 8) : ""} {a.reason ? `· ${a.reason}` : ""}
        </p>
      ))}
    </div>
  );
}
