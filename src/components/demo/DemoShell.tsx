"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FlaskConical, LayoutGrid, UserRound, ShieldCheck, ArrowLeft, LogOut } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { currentUser, logout } from "@/lib/demo/engine";

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Demo rejim: ma’lumotlar faqat shu brauzerda, haqiqiy to‘lov yo‘q"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 ${className}`}
    >
      <FlaskConical className="h-3 w-3" /> Demo
    </span>
  );
}

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, run } = useDemo();
  const user = state ? currentUser(state, "user") : null;
  const admin = state ? currentUser(state, "admin") : null;

  const nav = [
    { href: "/demo/elonlar", label: "E’lonlar", icon: LayoutGrid },
    { href: "/demo/kabinet", label: "Kabinet", icon: UserRound },
    { href: "/demo/admin", label: "Admin", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-brand-canvas">
      <header className="sticky top-0 z-40 border-b border-brand-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/demo" className="flex shrink-0 items-center gap-2">
            <Image src="/logo-dark.png" alt="ANGREN ESTATE" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
            <span className="hidden text-sm font-black tracking-tight text-brand-text sm:inline">ANGREN ESTATE</span>
            <DemoBadge />
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {nav.map((n) => {
              const active = pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition sm:px-3 sm:text-sm ${
                    active ? "bg-brand-light text-brand-primary" : "text-brand-muted hover:bg-brand-light/60 hover:text-brand-text"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/" className="hidden shrink-0 items-center gap-1 text-xs font-bold text-brand-muted hover:text-brand-text md:inline-flex">
            <ArrowLeft className="h-3.5 w-3.5" /> Asosiy sayt
          </Link>
        </div>
        {(user || admin) && (
          <div className="border-t border-brand-border/70 bg-brand-light/40">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-[11px] font-semibold text-brand-muted">
              {user && (
                <span className="inline-flex items-center gap-1.5">
                  Foydalanuvchi: <b className="text-brand-text">{user.name}</b>
                  <button type="button" onClick={() => run((s) => logout(s, "user"))} className="inline-flex items-center gap-0.5 text-rose-600 hover:underline">
                    <LogOut className="h-3 w-3" /> chiqish
                  </button>
                </span>
              )}
              {admin && (
                <span className="inline-flex items-center gap-1.5">
                  Admin: <b className="text-brand-text">{admin.name}</b>
                  <button type="button" onClick={() => run((s) => logout(s, "admin"))} className="inline-flex items-center gap-0.5 text-rose-600 hover:underline">
                    <LogOut className="h-3 w-3" /> chiqish
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-7">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-[11px] text-brand-subtle">
        DEMO rejim: barcha ma’lumotlar faqat shu brauzerning localStorage xotirasida saqlanadi. Haqiqiy to‘lov, baza yoki tashqi xizmat ishlatilmaydi.
      </footer>
    </div>
  );
}
