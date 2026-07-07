import Link from "next/link";
import { cn } from "@/lib/utils";

// Seletor de ano por link (sem JS) — usado em relatórios baseados em
// negociações faturadas (Financeiro, Negociações) para restringir ao ano
// corrente por padrão, com opção de ver outro ano ou tudo.
export function SeletorAno({
  basePath,
  anoSelecionado,
  anosDisponiveis,
}: {
  basePath: string;
  anoSelecionado: number | "todos";
  anosDisponiveis: number[];
}) {
  const opcoes: (number | "todos")[] = [...anosDisponiveis, "todos"];
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {opcoes.map((op) => (
        <Link
          key={op}
          href={op === anosDisponiveis[0] ? basePath : `${basePath}?ano=${op}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            anoSelecionado === op ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          )}
        >
          {op === "todos" ? "Todos" : op}
        </Link>
      ))}
    </div>
  );
}
