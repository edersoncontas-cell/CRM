export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-52 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2 rounded-2xl border-t-4 border-slate-300 bg-slate-100 p-3">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-16 rounded-xl bg-white" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
