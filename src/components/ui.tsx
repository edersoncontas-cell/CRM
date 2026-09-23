import Link from "next/link";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// PageHeader
// ─────────────────────────────────────────────
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--sobre-fundo-titulo)] sm:text-3xl">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1 text-sm text-[var(--sobre-fundo-texto)]">{subtitulo}</p>
        )}
      </div>
      {acao && <div className="flex max-w-full flex-wrap items-center gap-2">{acao}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────
export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm", className)}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Badge — mais cores, mais consistente
// ─────────────────────────────────────────────
type CorBadge = "slate" | "green" | "yellow" | "red" | "blue" | "purple" | "orange" | "emerald" | "fuchsia";

const COR_BADGE: Record<CorBadge, string> = {
  slate:   "bg-slate-100 text-slate-600",
  green:   "bg-green-100 text-green-700",
  yellow:  "bg-amber-100 text-amber-700",
  red:     "bg-red-100 text-red-700",
  blue:    "bg-brand-100 text-brand-700",
  purple:  "bg-purple-100 text-purple-700",
  orange:  "bg-orange-100 text-orange-700",
  emerald: "bg-emerald-100 text-emerald-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
};

export function Badge({
  children,
  tom = "slate",
}: {
  children: React.ReactNode;
  tom?: CorBadge;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", COR_BADGE[tom])}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// Termômetro (lead warmth) — com gradiente
// ─────────────────────────────────────────────
export function Termometro({ valor }: { valor: number }) {
  const cor =
    valor >= 70
      ? "bg-gradient-to-r from-green-400 to-emerald-500"
      : valor >= 40
      ? "bg-gradient-to-r from-amber-400 to-yellow-500"
      : "bg-gradient-to-r from-red-400 to-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all duration-500", cor)}
          style={{ width: `${valor}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-500">{valor}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// EmptyState — com ícone e CTA opcionais
// ─────────────────────────────────────────────
export function EmptyState({
  texto,
  subtexto,
  icone,
  acao,
}: {
  texto: string;
  subtexto?: string;
  icone?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-14 text-center">
      {icone && (
        <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">{icone}</div>
      )}
      <p className="font-semibold text-slate-600">{texto}</p>
      {subtexto && <p className="mt-1 text-sm text-slate-400">{subtexto}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// StatCard (KPI padronizado)
// ─────────────────────────────────────────────
type CorStat = "blue" | "green" | "amber" | "red" | "purple";

const COR_STAT: Record<CorStat, { bg: string; icon: string }> = {
  blue:   { bg: "bg-brand-50",  icon: "bg-brand-100 text-brand-600" },
  green:  { bg: "bg-green-50",  icon: "bg-green-100 text-green-600" },
  amber:  { bg: "bg-amber-50",  icon: "bg-amber-100 text-amber-600" },
  red:    { bg: "bg-red-50",    icon: "bg-red-100 text-red-600" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600" },
};

export function StatCard({
  icone,
  rotulo,
  valor,
  cor = "blue",
  href,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  cor?: CorStat;
  href?: string;
}) {
  const c = COR_STAT[cor];
  const conteudo = (
    <>
      <div className={cn("rounded-xl p-2.5 text-lg", c.icon)}>{icone}</div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-500">{rotulo}</div>
        <div className="text-xl font-bold text-slate-800">{valor}</div>
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-4 rounded-2xl p-4 transition hover:shadow-md hover:-translate-y-0.5",
          c.bg
        )}
      >
        {conteudo}
      </Link>
    );
  }
  return <div className={cn("flex items-center gap-4 rounded-2xl p-4", c.bg)}>{conteudo}</div>;
}

// ─────────────────────────────────────────────
// SectionTitle
// ─────────────────────────────────────────────
export function SectionTitle({
  children,
  icone,
}: {
  children: React.ReactNode;
  icone?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-700">
      {icone && <span className="text-brand-500">{icone}</span>}
      {children}
    </div>
  );
}
