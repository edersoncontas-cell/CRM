export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-40 rounded-lg bg-slate-200" />
        <div className="h-9 w-32 rounded-xl bg-slate-200" />
      </div>
      <div className="h-10 w-full rounded-xl bg-slate-100" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-1/4 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
