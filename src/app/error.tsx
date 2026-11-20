"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary. Without it an unexpected client/server error showed
 * Next.js' bare default screen; now the visitor gets a retry and a way home.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RouteError]", error);
  }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-white">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-[#eaf5f0] text-[#167d4f] flex items-center justify-center text-2xl font-black">
          !
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-900">Kutilmagan xatolik yuz berdi</h1>
          <p className="text-sm text-slate-600">
            Sahifani yuklashda muammo chiqdi. Qayta urinib ko‘ring yoki bosh sahifaga qayting.
          </p>
          <p className="text-xs text-slate-500">
            Произошла непредвиденная ошибка. Попробуйте ещё раз или вернитесь на главную.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-3 rounded-xl bg-[#167d4f] text-white text-sm font-bold shadow-sm hover:shadow-md transition-all"
          >
            Qayta urinish / Повторить
          </button>
          <Link
            href="/"
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-bold hover:bg-slate-50 transition-all"
          >
            Bosh sahifa / Главная
          </Link>
        </div>
      </div>
    </main>
  );
}
