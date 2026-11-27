"use client";

import Link from "next/link";
import { MapPin, BedDouble, Ruler, Phone, Plus } from "lucide-react";
import { useDemo, useTicker } from "@/lib/demo/store";
import { STATUS_NAMES, publicListings } from "@/lib/demo/engine";
import { Card, Loading, btnPrimary, fmtDate } from "@/components/demo/ui";
import { ListingThumb } from "@/components/demo/parts";
import { DemoBadge } from "@/components/demo/DemoShell";

const STATUS_STYLE: Record<string, string> = {
  top: "bg-gradient-to-r from-amber-400 to-orange-500 text-white",
  tez_sotiladi: "bg-rose-600 text-white",
  yaxshi_taklif: "bg-brand-primary text-white",
};

const TYPE_LABEL: Record<string, string> = { apartment: "Kvartira", house: "Hovli / Uy", commercial: "Tijorat", land: "Yer" };

export default function DemoPublicListings() {
  const { state } = useDemo();
  useTicker();
  if (!state) return <Loading />;
  const list = publicListings(state);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-brand-text sm:text-2xl">
            Saytdagi e’lonlar <DemoBadge />
          </h1>
          <p className="text-sm text-brand-muted">Faqat admin tasdiqlagan demo e’lonlar. TOP statusli e’lonlar birinchi turadi. Bu haqiqiy e’lonlar emas.</p>
        </div>
        <Link href="/demo/kabinet" className={btnPrimary}><Plus className="h-4 w-4" /> E’lon berish</Link>
      </div>
      {list.length === 0 ? (
        <Card className="text-center text-sm text-brand-muted">Hali tasdiqlangan demo e’lon yo‘q.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ listing: l, statuses, isTop, isPremium }) => (
            <article id={l.id} key={l.id} className={`group scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-2xs transition hover:shadow-md target:ring-4 target:ring-brand-primary/30 ${isTop ? "border-amber-300" : "border-brand-border"}`}>
              <div className="relative h-44 overflow-hidden">
                <ListingThumb photos={l.photos} title={l.title} />
                <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                  {isPremium && <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow">Premium</span>}
                  {statuses.map((s) => (
                    <span key={s.id} className={`rounded-full px-2.5 py-0.5 text-[11px] font-black shadow ${STATUS_STYLE[s.type]}`}>{STATUS_NAMES[s.type].uz}</span>
                  ))}
                </div>
                <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 shadow">Demo</span>
              </div>
              <div className="space-y-1.5 p-4">
                <p className="text-lg font-black text-brand-primary">{l.price.toLocaleString("ru-RU")} {l.currency === "USD" ? "$" : "so‘m"}</p>
                <h2 className="line-clamp-1 text-sm font-black text-brand-text">{l.title}</h2>
                <p className="flex items-center gap-1 text-xs text-brand-muted"><MapPin className="h-3.5 w-3.5" /> {l.location}</p>
                <div className="flex flex-wrap gap-3 text-xs text-brand-muted">
                  <span>{TYPE_LABEL[l.propertyType]} · {l.dealType === "rent" ? "Ijara" : "Sotuv"}</span>
                  {l.rooms ? <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {l.rooms}</span> : null}
                  {l.area ? <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {l.area} m²</span> : null}
                </div>
                {l.description && <p className="line-clamp-2 text-xs text-brand-text">{l.description}</p>}
                <div className="flex items-center justify-between pt-1 text-[11px] text-brand-subtle">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {l.phone}</span>
                  <span>{fmtDate(l.decidedAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
