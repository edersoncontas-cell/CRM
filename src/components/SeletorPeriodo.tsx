import Link from "next/link";
import { cn } from "@/lib/utils";
import { MESES, type Periodo } from "@/lib/periodo-funil";

// Seletor de período por link (sem JS): ano em cima, mês embaixo.
//
// Duas linhas em vez de um menu suspenso porque ele usa isto no celular, na
// rua: menu suspenso com 13 opções pede mira, e link é um toque. "Ano todo"
// vem primeiro na linha dos meses para sempre haver um caminho de volta —
// sem ele, escolher um mês seria uma porta de mão única.
export function SeletorPeriodo({
  basePath,
  periodo,
  anosDisponiveis,
}: {
  basePath: string;
  periodo: Periodo;
  anosDisponiveis: number[];
}) {
  const anoPadrao = anosDisponiveis[0];
  const link = (ano: number | "todos", mes: number | null) => {
    const q = new URLSearchParams();
    if (!(ano === anoPadrao && mes == null)) {
      q.set("ano", String(ano));
      if (mes != null) q.set("mes", String(mes));
    }
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const botao = "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all";
  const aceso = "bg-slate-900 text-white shadow-sm";
  const apagado = "text-slate-500 hover:bg-slate-50 hover:text-slate-700";

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-1">
        {[...anosDisponiveis, "todos" as const].map((ano) => (
          <Link
            key={String(ano)}
            // Trocar de ano mantém o mês escolhido: comparar setembro com
            // setembro do ano passado é a pergunta que ele faz, e refazer o
            // clique do mês a cada troca seria trabalho à toa.
            href={link(ano, ano === "todos" ? null : periodo.mes)}
            className={cn(botao, periodo.ano === ano ? aceso : apagado)}
          >
            {ano === "todos" ? "Todos" : ano}
          </Link>
        ))}
      </div>
      {periodo.ano !== "todos" && (
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-1.5">
          <Link href={link(periodo.ano, null)} className={cn(botao, periodo.mes == null ? aceso : apagado)}>
            Ano todo
          </Link>
          {MESES.map((nome, i) => (
            <Link
              key={nome}
              href={link(periodo.ano, i + 1)}
              title={nome}
              className={cn(botao, "capitalize", periodo.mes === i + 1 ? aceso : apagado)}
            >
              {nome.slice(0, 3)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
