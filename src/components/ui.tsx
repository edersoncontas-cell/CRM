import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{titulo}</h1>
        {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tom = "slate",
}: {
  children: React.ReactNode;
  tom?: "slate" | "green" | "yellow" | "red" | "blue";
}) {
  const cores: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-brand-100 text-brand-700",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", cores[tom])}>
      {children}
    </span>
  );
}

export function Termometro({ valor }: { valor: number }) {
  const cor = valor >= 70 ? "bg-green-500" : valor >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", cor)} style={{ width: `${valor}%` }} />
      </div>
      <span className="text-xs text-slate-500">{valor}%</span>
    </div>
  );
}

export function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
      {texto}
    </div>
  );
}
