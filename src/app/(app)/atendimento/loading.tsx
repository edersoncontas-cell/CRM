export default function Loading() {
  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] animate-pulse sm:-m-6 md:-m-8">
      <div className="hidden w-80 shrink-0 space-y-2 border-r border-slate-100 bg-white p-3 sm:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-2">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 rounded bg-slate-200" />
              <div className="h-2.5 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 space-y-3 bg-slate-50 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-10 rounded-2xl bg-slate-200 ${i % 2 === 0 ? "w-2/3" : "ml-auto w-1/2"}`} />
        ))}
      </div>
    </div>
  );
}
