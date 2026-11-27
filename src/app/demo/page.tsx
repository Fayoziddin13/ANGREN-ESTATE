"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserRound, ShieldCheck, LogIn, ArrowRight, LayoutGrid } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { DEMO_CREDENTIALS, currentUser, login, type Role } from "@/lib/demo/engine";
import { Card, Loading, ResultBanner, btnPrimary, inputCls, labelCls } from "@/components/demo/ui";
import { DemoBadge } from "@/components/demo/DemoShell";

function LoginCard({ role, onDone }: { role: Role; onDone: (role: Role) => void }) {
  const { state, run, result, clearResult } = useDemo();
  const [loginName, setLoginName] = useState<string>(DEMO_CREDENTIALS[role].login);
  const [password, setPassword] = useState<string>(DEMO_CREDENTIALS[role].password);
  const signedIn = state ? currentUser(state, role) : null;
  const Icon = role === "admin" ? ShieldCheck : UserRound;

  return (
    <Card className="flex flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${role === "admin" ? "bg-brand-dark" : "bg-brand-primary"} text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-brand-text">{role === "admin" ? "Admin sifatida kirish" : "Foydalanuvchi sifatida kirish"}</h2>
          <p className="text-xs text-brand-muted">
            {role === "admin" ? "Narxlar, moderatsiya, statuslar, promokodlar, to‘lovlar" : "E’lon berish, to‘lov, statuslar, mening e’lonlarim"}
          </p>
        </div>
      </div>
      {signedIn ? (
        <div className="mt-auto space-y-3">
          <p className="rounded-xl bg-brand-light px-3 py-2 text-sm font-semibold text-brand-text">
            Siz <b>{signedIn.name}</b> sifatida kirgansiz.
          </p>
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => onDone(role)}>
            {role === "admin" ? "Admin panelga o‘tish" : "Kabinetga o‘tish"} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form
          className="mt-auto space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const r = run((s) => login(s, role, loginName, password));
            if (r.ok) onDone(role);
          }}
        >
          <div>
            <label className={labelCls} htmlFor={`${role}-login`}>Login</label>
            <input id={`${role}-login`} className={inputCls} value={loginName} onChange={(e) => setLoginName(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${role}-password`}>Parol</label>
            <input id={`${role}-password`} className={inputCls} type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </div>
          <p className="text-[11px] text-brand-muted">
            Demo hisob avtomatik yaratilgan: <code className="rounded bg-slate-100 px-1">{DEMO_CREDENTIALS[role].login}</code> /{" "}
            <code className="rounded bg-slate-100 px-1">{DEMO_CREDENTIALS[role].password}</code>. Faqat shu brauzerda ishlaydi.
          </p>
          <ResultBanner result={result && !result.ok ? result : null} onClose={clearResult} />
          <button type="submit" className={`${btnPrimary} w-full`}>
            <LogIn className="h-4 w-4" /> Kirish
          </button>
        </form>
      )}
    </Card>
  );
}

function DemoHome() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useDemo();
  const next = params.get("next");
  if (!state) return <Loading />;

  const go = (role: Role) => {
    const safeNext = next && next.startsWith("/demo/") ? next : null;
    router.push(safeNext ?? (role === "admin" ? "/demo/admin" : "/demo/kabinet"));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-brand-dark to-brand-primary p-6 text-white sm:p-8">
        <DemoBadge className="mb-3" />
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Monetizatsiya — lokal DEMO rejim</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          Bepul birinchi e’lon, pullik keyingi e’lonlar, tariflar, promokodlar, demo to‘lov, moderatsiya va 3/7/30 kunlik statuslarni shu
          brauzerda sinab ko‘ring. Hech qanday baza, to‘lov tizimi yoki tashqi xizmat ishlatilmaydi; haqiqiy pul yechilmaydi.
        </p>
        <Link href="/demo/elonlar" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-bold hover:bg-white/25">
          <LayoutGrid className="h-4 w-4" /> Saytdagi demo e’lonlarni ko‘rish
        </Link>
      </div>
      {next ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">Davom etish uchun kiring.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <LoginCard role="user" onDone={go} />
        <LoginCard role="admin" onDone={go} />
      </div>
      <Card>
        <h2 className="mb-2 text-sm font-black text-brand-text">Qanday sinash mumkin</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-muted">
          <li>Foydalanuvchi bo‘lib kiring va birinchi e’lonni bepul joylang.</li>
          <li>Ikkinchi e’lonni yarating — tarif tanlanadi, narx va promokod chegirmasi ko‘rinadi, demo to‘lov sahifasi ochiladi.</li>
          <li>Admin bo‘lib kiring (shu brauzerda, boshqa tabda ham bo‘ladi): moderatsiyada tasdiqlang yoki rad eting.</li>
          <li>Tasdiqlangan e’lon uchun status sotib oling — u faqat admin tasdiqlagach faol bo‘ladi va muddat shundan hisoblanadi.</li>
          <li>Admin panelda narxlarni o‘zgartiring — foydalanuvchi formasida yangi narx darhol ko‘rinadi. “Reset Demo” hammasini boshidan boshlaydi.</li>
        </ol>
      </Card>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DemoHome />
    </Suspense>
  );
}
