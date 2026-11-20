/** Skeleton shown while the property page is rendered on the server. */
export default function PropertyLoading() {
  return (
    <main className="min-h-screen bg-white" aria-busy="true" aria-label="Yuklanmoqda / Загрузка">
      <div className="h-14 bg-[#167d4f]" />
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="aspect-[16/9] w-full rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="h-8 w-56 rounded bg-slate-200" />
        <div className="h-5 w-3/4 rounded bg-slate-200" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </main>
  );
}
