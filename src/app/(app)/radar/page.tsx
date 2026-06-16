import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { recomendacaoMes, calendarioAnual, ESTACAO_INFO } from "@/lib/sazonalidade";
import { CATEGORIAS } from "@/lib/comparativo";
import { CalendarRange, Lightbulb } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const agora = new Date();
  const atual = recomendacaoMes(agora.getMonth());
  const ano = calendarioAnual();
  const info = ESTACAO_INFO[atual.estacao];

  // máquinas próprias por categoria, para sugerir o que ofertar agora
  const minhas = await db.maquina.findMany({ where: { proprio: true } });
  const sugeridas = minhas.filter((m) => atual.oportunidades.includes(m.categoria));

  return (
    <div>
      <PageHeader
        titulo="Radar de sazonalidade"
        subtitulo="A melhor época para ofertar cada máquina no sul do ES"
      />

      {/* Mês atual */}
      <Card className="mb-6 border-brand-300 bg-gradient-to-br from-brand-700 to-brand-900 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-brand-200">
              <CalendarRange size={16} /> {atual.mes} · {info.emoji} {info.rotulo}
            </div>
            <h2 className="mt-1 text-2xl font-bold">{atual.foco}</h2>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-white/10 p-3 text-sm">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-agro-500" /> {atual.dica}
        </p>
        {sugeridas.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-brand-200">Empurre agora:</div>
            <div className="flex flex-wrap gap-2">
              {sugeridas.map((m) => (
                <Link
                  key={m.id}
                  href={`/comparativo?maquina=${m.id}`}
                  className="rounded-full bg-agro-500 px-3 py-1 text-xs font-semibold text-brand-950 hover:opacity-90"
                >
                  {m.marca} {m.modelo}
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Calendário anual */}
      <h2 className="mb-3 font-semibold text-slate-700">Calendário do ano</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ano.map((r, i) => {
          const ei = ESTACAO_INFO[r.estacao];
          const atualMes = i === agora.getMonth();
          return (
            <Card key={r.mes} className={atualMes ? "border-brand-400 ring-2 ring-brand-200" : ""}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-slate-800">{r.mes}</span>
                <Badge tom={ei.tom}>{ei.emoji} {ei.rotulo.split(" ")[0]}</Badge>
              </div>
              <p className="text-sm font-medium text-brand-700">{r.foco}</p>
              <p className="mt-1 text-xs text-slate-500">{r.dica}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.oportunidades.map((c) => (
                  <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {CATEGORIAS[c] ?? c}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
