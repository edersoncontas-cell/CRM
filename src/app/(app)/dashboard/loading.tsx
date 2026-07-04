export default function Loading() {
  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-4 md:-m-8 md:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-56 rounded-lg" style={{ background: "#27272a" }} />
          <div className="h-3 w-40 rounded-lg" style={{ background: "#18181b" }} />
        </div>
        <div className="h-8 w-8 rounded-full" style={{ background: "#27272a" }} />
      </div>
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="space-y-2">
          <div className="h-4 w-40 rounded" style={{ background: "#27272a" }} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl" style={{ background: "#18181b", border: "1px solid #27272a" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
