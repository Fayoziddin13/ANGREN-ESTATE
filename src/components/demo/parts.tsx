"use client";

import { useState } from "react";
import { ImagePlus, Trash2, Tag, Sparkles } from "lucide-react";
import { fileToSmallDataUrl } from "@/lib/demo/store";
import { formatSum, type ListingInput, type Quote } from "@/lib/demo/engine";
import { inputCls, labelCls, btnSecondary } from "./ui";

export function PriceBreakdown({ q, compact = false }: { q: Quote; compact?: boolean }) {
  if (q.free) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm">
        <div className="flex items-center justify-between font-black text-emerald-800">
          <span>To‘lov summasi</span>
          <span>Bepul</span>
        </div>
        {!compact && <p className="mt-0.5 text-xs text-emerald-700">Birinchi e’lon huquqi ishlatiladi (yoki monetizatsiya o‘chiq).</p>}
      </div>
    );
  }
  return (
    <div className="space-y-1.5 rounded-xl border border-brand-border bg-brand-canvas px-3.5 py-3 text-sm">
      <Row label="Tarif narxi" value={formatSum(q.base)} />
      {q.promotion && <Row label={`Aksiya: ${q.promotion.name} (−${q.promotion.percent}%)`} value={`−${formatSum(q.promotionDiscount)}`} tone="text-emerald-700" />}
      {q.promo && (
        <Row
          label={`Promokod ${q.promo.code} (${q.promo.kind === "percent" ? `−${q.promo.value}%` : `−${formatSum(q.promo.value)}`})`}
          value={`−${formatSum(q.promoDiscount)}`}
          tone="text-emerald-700"
        />
      )}
      {q.promoNotApplied && <p className="text-xs font-semibold text-amber-700">Promokod qo‘llanmadi: aksiya chegirmasi kattaroq. Chegirmalar qo‘shilmaydi — eng kattasi ishlaydi.</p>}
      <div className="flex items-center justify-between border-t border-brand-border pt-1.5 text-base font-black text-brand-text">
        <span>To‘lov summasi</span>
        <span>{formatSum(q.total)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, tone = "text-brand-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${tone}`}>
      <span className="text-brand-muted">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export function PromoInput({ value, onApply, error, appliedCode }: { value: string; onApply: (code: string) => void; error: string | null; appliedCode: string | null }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <label className={labelCls} htmlFor="demo-promo">Promokod (ixtiyoriy)</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle" />
          <input
            id="demo-promo"
            className={`${inputCls} pl-9 uppercase`}
            value={draft}
            placeholder="DEMO10"
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply(draft);
              }
            }}
          />
        </div>
        <button type="button" className={btnSecondary} onClick={() => onApply(draft)}>
          Qo‘llash
        </button>
        {appliedCode && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setDraft("");
              onApply("");
            }}
          >
            Olib tashlash
          </button>
        )}
      </div>
      {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
      {appliedCode && !error ? <p className="mt-1 text-xs font-semibold text-emerald-700">Promokod qo‘llandi: {appliedCode}</p> : null}
    </div>
  );
}

export const EMPTY_LISTING: ListingInput = {
  title: "",
  dealType: "sale",
  propertyType: "apartment",
  price: 0,
  currency: "USD",
  rooms: null,
  area: null,
  location: "",
  description: "",
  phone: "+998 90 000 00 01",
  photos: [],
};

export function ListingFields({ value, onChange }: { value: ListingInput; onChange: (v: ListingInput) => void }) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const set = <K extends keyof ListingInput>(k: K, v: ListingInput[K]) => onChange({ ...value, [k]: v });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const room = 4 - value.photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setPhotoError("Ko‘pi bilan 4 ta rasm");
    const out: string[] = [];
    for (const f of list) {
      try {
        out.push(await fileToSmallDataUrl(f));
      } catch (e) {
        setPhotoError((e as Error).message);
      }
    }
    if (out.length) onChange({ ...value, photos: [...value.photos, ...out] });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor="f-title">Sarlavha *</label>
        <input id="f-title" className={inputCls} value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="Masalan: 2 xonali kvartira, 6-mavze" />
      </div>
      <div>
        <label className={labelCls} htmlFor="f-deal">Turi</label>
        <select id="f-deal" className={inputCls} value={value.dealType} onChange={(e) => set("dealType", e.target.value as ListingInput["dealType"])}>
          <option value="sale">Sotuv</option>
          <option value="rent">Ijara</option>
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="f-ptype">Mulk turi</label>
        <select id="f-ptype" className={inputCls} value={value.propertyType} onChange={(e) => set("propertyType", e.target.value as ListingInput["propertyType"])}>
          <option value="apartment">Kvartira</option>
          <option value="house">Hovli / Uy</option>
          <option value="commercial">Tijorat</option>
          <option value="land">Yer</option>
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="f-price">Mulk narxi *</label>
        <div className="flex gap-2">
          <input
            id="f-price"
            className={inputCls}
            inputMode="numeric"
            value={value.price ? String(value.price) : ""}
            onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")) || 0)}
            placeholder="35000"
          />
          <select aria-label="Valyuta" className={`${inputCls} !w-24`} value={value.currency} onChange={(e) => set("currency", e.target.value as ListingInput["currency"])}>
            <option value="USD">USD</option>
            <option value="UZS">so‘m</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls} htmlFor="f-rooms">Xonalar</label>
          <input id="f-rooms" className={inputCls} inputMode="numeric" value={value.rooms ?? ""} onChange={(e) => set("rooms", num(e.target.value.replace(/\D/g, "")))} />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-area">Maydon, m²</label>
          <input id="f-area" className={inputCls} inputMode="numeric" value={value.area ?? ""} onChange={(e) => set("area", num(e.target.value.replace(/[^\d.]/g, "")))} />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="f-loc">Manzil *</label>
        <input id="f-loc" className={inputCls} value={value.location} onChange={(e) => set("location", e.target.value)} placeholder="Angren, 6-mavze" />
      </div>
      <div>
        <label className={labelCls} htmlFor="f-phone">Telefon *</label>
        <input id="f-phone" className={inputCls} value={value.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor="f-desc">Tavsif</label>
        <textarea id="f-desc" rows={3} className={inputCls} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <span className={labelCls}>Rasmlar (4 tagacha, brauzerda kichraytiriladi)</span>
        <div className="flex flex-wrap gap-2">
          {value.photos.map((p, i) => (
            <div key={i} className="group relative h-20 w-24 overflow-hidden rounded-xl border border-brand-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Rasm ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Rasmni o‘chirish"
                onClick={() => set("photos", value.photos.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {value.photos.length < 4 && (
            <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-border-dark text-[11px] font-bold text-brand-muted hover:bg-brand-light">
              <ImagePlus className="h-5 w-5" /> Qo‘shish
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        {photoError ? <p className="mt-1 text-xs font-semibold text-rose-600">{photoError}</p> : null}
      </div>
    </div>
  );
}

export function ListingThumb({ photos, title }: { photos: string[]; title: string }) {
  if (photos[0]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photos[0]} alt={title} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-light to-white text-brand-primary">
      <Sparkles className="h-6 w-6 opacity-60" />
    </div>
  );
}
