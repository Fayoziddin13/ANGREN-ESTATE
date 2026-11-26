"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, LogOut, UserRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/layout/Header";

export function TestLoginClient() {
  const router = useRouter();
  const { user, handleLogout } = useAuth();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(n: 1 | 2) {
    setBusy(n);
    setError(null);
    try {
      const res = await fetch("/api/dev/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: n }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || json.error || "login failed");
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });
      if (sessionError) throw sessionError;
      router.push("/kabinet");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-10 space-y-5">
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-black">
            <FlaskConical className="h-5 w-5" /> Test kirishi · Тестовый вход
          </div>
          <p className="text-xs text-amber-800">
            Faqat lokal kompyuterda va faqat test bazasi (angren-estate-test) bilan ishlaydi. Production va Vercel’da bu sahifa
            mavjud emas. / Работает только локально и только с тестовой базой.
          </p>
        </div>

        {user && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div className="text-sm">
              <p className="font-bold text-slate-900">{user.full_name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button onClick={() => handleLogout()} className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
        )}

        <div className="grid gap-3">
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              data-testid={`test-login-${n}`}
              onClick={() => login(n)}
              disabled={busy !== null}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#167d4f] transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <UserRound className="h-8 w-8 text-[#167d4f]" />
                <div>
                  <p className="font-black text-slate-900">Test foydalanuvchi {n}</p>
                  <p className="text-xs text-slate-500">test{n}@angren-estate.test {busy === n ? "· kirilmoqda…" : ""}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-rose-600 break-words">{error}</p>}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1.5">
          <p className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck className="h-4 w-4 text-[#167d4f]" /> Admin panel
          </p>
          <p>
            <Link href="/admin/login" className="text-[#167d4f] font-bold underline">/admin/login</Link> — login: <b>admin</b>, parol:
            <code className="mx-1">.env.development.local</code> faylidagi <code>ADMIN_PASSWORD</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
