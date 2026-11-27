"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, RefreshCw, X, Check, Undo2, Ban, Pencil, Sparkles, ExternalLink, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  BOOST_LABELS, MODERATION_LABELS, ORDER_LABELS, PROPERTY_TYPE_LABELS, REFUND_LABELS, STICKER_LABELS,
  StatusPill, boostDisplayStatus, formatDate, formatSum, type Locale,
} from "@/lib/monetization/client";

/** Admin moderation queue: listing applications and sticker requests. */

async function adminApi(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/admin/monetization/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success !== false, data: json.data, message: json.message?.uz || json.error };
}

const TABS = ["PENDING_REVIEW", "REVISION_REQUIRED", "AWAITING_PAYMENT", "APPROVED", "REJECTED", "CANCELLED_BY_USER", "all"];

export default function ModerationPage() {
  const { locale: raw } = useLanguage();
  const locale: Locale = raw === "ru" ? "ru" : "uz";
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const [view, setView] = useState<"submissions" | "boosts">("submissions");
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [boostStatus, setBoostStatus] = useState("PENDING_APPROVAL");
  const [rows, setRows] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, b] = await Promise.all([adminApi(`submissions?status=${status}`), adminApi(`boosts?status=${boostStatus}`)]);
    if (s.ok) setRows(s.data);
    else setErr(s.message);
    if (b.ok) setBoosts(b.data);
    setLoading(false);
  }, [status, boostStatus]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id: string) {
    const r = await adminApi(`submissions/${id}`);
    if (r.ok) setDetail(r.data);
    else setErr(r.message);
  }

  async function act(path: string, body: any, okMsg: string) {
    setErr(null);
    setMsg(null);
    const r = await adminApi(path, { method: "POST", body: JSON.stringify(body) });
    if (!r.ok) {
      setErr(r.message);
      return null;
    }
    setMsg(okMsg);
    await load();
    return r.data;
  }

  async function decide(action: "approve" | "reject" | "revision") {
    if (!detail) return;
    const sid = detail.submission.id;
    let note: string | null = null;
    if (action !== "approve") {
      note = window.prompt(action === "reject" ? t("Rad etish sababi:", "Причина отказа:") : t("Nimani tuzatish kerak?", "Что исправить?"));
      if (!note) return;
    }
    const data = await act(`submissions/${sid}/${action}`, { note }, action === "approve"
      ? t("Tasdiqlandi: qoralama obyekt yaratildi. Uni tahrirlab chop eting.", "Одобрено: создан черновик объекта. Отредактируйте и опубликуйте его.")
      : action === "reject" ? t("Rad etildi (pullik bo‘lsa pul qaytarildi).", "Отклонено (оплата возвращена, если была).")
      : t("Tuzatishga qaytarildi.", "Отправлено на исправление."));
    if (data) await openDetail(sid);
  }

  async function saveEdit(payload: any) {
    const r = await adminApi(`submissions/${detail.submission.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (!r.ok) return setErr(r.message);
    setMsg(t("Ariza ma’lumotlari yangilandi (to‘lov o‘zgarmadi).", "Данные заявки обновлены (оплата не изменена)."));
    await openDetail(detail.submission.id);
  }

  async function decideBoost(id: string, action: "approve" | "reject" | "revoke") {
    let note: string | null = null;
    if (action !== "approve") {
      note = window.prompt(t("Sababi:", "Причина:"));
      if (!note) return;
    }
    await act(`boosts/${id}/${action}`, { note }, action === "approve" ? t("Stiker faollashtirildi.", "Стикер активирован.") : t("Bajarildi.", "Готово."));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf5f0]/60 text-[#167d4f] border border-[#dee8e3]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">{t("Moderatsiya", "Модерация")}</h1>
            <p className="text-xs text-slate-500">{t("E'lon arizalari va stiker so‘rovlari", "Заявки на объявления и стикеры")}</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-700 text-xs font-bold">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("Yangilash", "Обновить")}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setView("submissions")} className={`px-4 py-2 rounded-2xl text-xs font-bold ${view === "submissions" ? "bg-[#167d4f] text-white" : "bg-white border border-slate-200"}`}>
          {t("Arizalar", "Заявки")}
        </button>
        <button onClick={() => setView("boosts")} className={`px-4 py-2 rounded-2xl text-xs font-bold ${view === "boosts" ? "bg-[#167d4f] text-white" : "bg-white border border-slate-200"}`}>
          {t("Stikerlar", "Стикеры")}
        </button>
      </div>

      {msg && <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">{msg}</p>}
      {err && <p className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{err}</p>}

      {view === "submissions" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${status === s ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>
                {s === "all" ? t("Hammasi", "Все") : MODERATION_LABELS[s][locale]}
              </button>
            ))}
          </div>
          <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
            {rows.length === 0 && <p className="p-6 text-center text-xs text-slate-500">{t("Arizalar yo‘q", "Заявок нет")}</p>}
            {rows.map((r) => (
              <button key={r.id} data-testid="mod-row" onClick={() => openDetail(r.id)} className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 flex flex-wrap items-center gap-3">
                <StatusPill label={MODERATION_LABELS[r.moderation_status]} locale={locale} />
                <span className="text-[11px] font-bold text-slate-500">{r.billing === "free" ? t("Bepul", "Бесплатно") : t("Pullik", "Платно")}</span>{r.listing_tier === "premium" && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">Premium</span>}
                {r.orders?.[0] && <StatusPill label={ORDER_LABELS[r.orders[0].status]} locale={locale} />}
                {r.flags?.phone_conflict && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700"><AlertTriangle className="h-3.5 w-3.5" />{t("Telefon takrorlangan", "Повтор телефона")}</span>
                )}
                <span className="text-sm font-bold text-slate-900 flex-1 min-w-[200px] truncate">
                  {PROPERTY_TYPE_LABELS[r.payload?.property_type]?.[locale]} · {r.payload?.location}
                </span>
                <span className="text-[11px] text-slate-500">{r.contact_name} · {r.contact_phone} · {r.customer_identities?.provider}</span>
                <span className="text-[11px] text-slate-400">{formatDate(r.submitted_at || r.created_at, locale)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {["PENDING_APPROVAL", "ACTIVE", "AWAITING_PAYMENT", "REJECTED", "REVOKED", "CANCELLED", "all"].map((s) => (
              <button key={s} onClick={() => setBoostStatus(s)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${boostStatus === s ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600"}`}>
                {s === "all" ? t("Hammasi", "Все") : BOOST_LABELS[s][locale]}
              </button>
            ))}
          </div>
          <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
            {boosts.length === 0 && <p className="p-6 text-center text-xs text-slate-500">{t("So‘rovlar yo‘q", "Запросов нет")}</p>}
            {boosts.map((b) => (
              <div key={b.id} data-testid="boost-row" className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
                <StatusPill label={BOOST_LABELS[boostDisplayStatus(b)]} locale={locale} />
                <span className="text-sm font-black">{STICKER_LABELS[b.sticker_type]?.[locale]} · {b.duration_days} {t("kun", "дн.")}</span>
                <span className="text-[11px] text-slate-500">{b.billing === "free" ? t("Bepul", "Бесплатно") : formatSum(b.orders?.[0]?.final_amount_uzs, locale)}</span>
                <Link href={`/properties/${b.property_id}`} target="_blank" className="text-xs text-[#167d4f] font-bold flex-1 truncate">{b.property_title}</Link>
                {b.starts_at && <span className="text-[11px] text-slate-500">{formatDate(b.starts_at, locale)} → {formatDate(b.ends_at, locale)}</span>}
                <div className="flex gap-1.5">
                  {b.status === "PENDING_APPROVAL" && (
                    <>
                      <button data-testid="boost-approve" onClick={() => decideBoost(b.id, "approve")} className="px-3 py-1.5 rounded-xl bg-[#167d4f] text-white text-xs font-bold">{t("Tasdiqlash", "Одобрить")}</button>
                      <button onClick={() => decideBoost(b.id, "reject")} className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{t("Rad etish", "Отклонить")}</button>
                    </>
                  )}
                  {b.status === "ACTIVE" && (
                    <button onClick={() => decideBoost(b.id, "revoke")} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">{t("To‘xtatish", "Отозвать")}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {detail && <SubmissionDrawer locale={locale} detail={detail} onClose={() => setDetail(null)} onDecide={decide} onSave={saveEdit} />}
    </div>
  );
}

function SubmissionDrawer({ locale, detail, onClose, onDecide, onSave }: {
  locale: Locale; detail: any; onClose: () => void; onDecide: (a: "approve" | "reject" | "revision") => void; onSave: (p: any) => void;
}) {
  const t = (uz: string, ru: string) => (locale === "uz" ? uz : ru);
  const s = detail.submission;
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>({ ...s.payload });
  const canDecide = s.moderation_status === "PENDING_REVIEW";
  const canEdit = s.moderation_status === "PENDING_REVIEW" || s.moderation_status === "REVISION_REQUIRED";
  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="h-full w-full max-w-2xl bg-white overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="mod-drawer">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex flex-wrap gap-2 items-center">
              <StatusPill label={MODERATION_LABELS[s.moderation_status]} locale={locale} />
              <span className="text-xs font-bold text-slate-500">{s.billing === "free" ? t("Bepul (birinchi e'lon)", "Бесплатно (первое)") : t("Pullik", "Платно")}</span>{s.listing_tier === "premium" && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">Premium</span>}
              {s.flags?.phone_conflict && <span className="text-xs font-bold text-orange-700">{t("Bu telefon boshqa hisobda bepul ishlatilgan", "Телефон уже использован другим аккаунтом")}</span>}
            </div>
            <h2 className="text-lg font-black mt-1">{PROPERTY_TYPE_LABELS[s.payload?.property_type]?.[locale]} · {s.payload?.location}</h2>
            <p className="text-xs text-slate-500">
              {s.contact_name} · {s.contact_phone} {s.phone_verified ? "✓ Telegram" : ""} · {s.customer_identities?.provider} {s.customer_identities?.email || ""}
            </p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {detail.photo_urls?.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {detail.photo_urls.map((u: string | null, i: number) => (
              <a key={i} href={u || "#"} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                {u && <img src={u} alt="" className="h-full w-full object-cover" />}
              </a>
            ))}
          </div>
        )}

        {!edit ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-1">
            <p><b>{t("Bitim", "Сделка")}:</b> {s.payload?.deal_type === "rent" ? t("Ijara", "Аренда") : t("Sotuv", "Продажа")}</p>
            <p><b>{t("Xonalar", "Комнат")}:</b> {s.payload?.rooms ?? "—"} · <b>{t("Maydon", "Площадь")}:</b> {s.payload?.area ?? "—"} m²</p>
            <p><b>{t("Narx", "Цена")}:</b> {s.payload?.price ?? "—"} {s.payload?.currency}</p>
            <p className="whitespace-pre-wrap"><b>{t("Tavsif", "Описание")}:</b> {s.payload?.description}</p>
            {s.admin_note && <p className="text-orange-700"><b>{t("Izoh", "Комментарий")}:</b> {s.admin_note}</p>}
            {canEdit && (
              <button onClick={() => setEdit(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#167d4f]"><Pencil className="h-3.5 w-3.5" />{t("Tahrirlash", "Редактировать")}</button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
            <input className={input} value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <input className={input} type="number" placeholder="rooms" value={form.rooms ?? ""} onChange={(e) => setForm({ ...form, rooms: e.target.value })} />
              <input className={input} type="number" placeholder="m²" value={form.area ?? ""} onChange={(e) => setForm({ ...form, area: e.target.value })} />
              <input className={input} type="number" placeholder="price" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <textarea className={input} rows={4} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={() => { onSave(form); setEdit(false); }} className="px-4 py-2 rounded-xl bg-[#167d4f] text-white text-xs font-bold">{t("Saqlash", "Сохранить")}</button>
              <button onClick={() => setEdit(false)} className="px-4 py-2 rounded-xl border text-xs font-bold">{t("Bekor", "Отмена")}</button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-black text-slate-700">{t("To‘lovlar", "Платежи")}</p>
          {detail.orders.length === 0 && <p className="text-xs text-slate-500">—</p>}
          {detail.orders.map((o: any) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill label={ORDER_LABELS[o.status]} locale={locale} />
              <span>{formatSum(o.final_amount_uzs, locale)}</span>
              {o.discount_uzs > 0 && <span className="text-emerald-700">(−{formatSum(o.discount_uzs, locale)} {o.discount_source})</span>}
              <span className="text-slate-400">{formatDate(o.paid_at || o.created_at, locale)}</span>
            </div>
          ))}
          {detail.refunds.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 text-xs"><StatusPill label={REFUND_LABELS[r.status]} locale={locale} /> {formatSum(r.amount_uzs, locale)} · {r.reason}</div>
          ))}
        </div>

        {s.property_id && (
          <Link href={`/admin/properties/${s.property_id}`} className="inline-flex items-center gap-1 text-sm font-bold text-[#167d4f]">
            {t("Obyektni tahrirlash va chop etish", "Редактировать и опубликовать объект")} <ExternalLink className="h-4 w-4" />
          </Link>
        )}

        {canDecide && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <button data-testid="mod-approve" onClick={() => onDecide("approve")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#167d4f] text-white text-xs font-bold"><Check className="h-4 w-4" />{t("Tasdiqlash", "Одобрить")}</button>
            <button data-testid="mod-revision" onClick={() => onDecide("revision")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-orange-500 text-white text-xs font-bold"><Undo2 className="h-4 w-4" />{t("Tuzatishga qaytarish", "На исправление")}</button>
            <button data-testid="mod-reject" onClick={() => onDecide("reject")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold"><Ban className="h-4 w-4" />{t("Rad etish", "Отклонить")}</button>
          </div>
        )}
        {s.moderation_status === "REVISION_REQUIRED" && (
          <button onClick={() => onDecide("reject")} className="px-4 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{t("Rad etish", "Отклонить")}</button>
        )}

        <div className="space-y-1">
          <p className="text-xs font-black text-slate-700 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />{t("Audit jurnali", "Журнал аудита")}</p>
          {detail.audit.map((a: any) => (
            <p key={a.id} className="text-[11px] text-slate-500">{formatDate(a.created_at, locale)} · {a.actor_type}:{a.actor_id || "—"} · <b>{a.action}</b> {a.reason ? `· ${a.reason}` : ""}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
