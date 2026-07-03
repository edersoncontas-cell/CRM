import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { ClipboardList, TrendingUp, Banknote, Package } from "lucide-react";

export const dynamic = "force-dynamic";

const COND_LABEL: Record<string, string> = {
  avista: "À vista",
  consorcio: "Consórcio",
  financiamento: "Financiamento",
  outro: "Outro",
};

function pct(n: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export default async function HistoricoPage() {
  const [ganhas, todas] = await Promise.all([
    db.negociacao.findMany({
      where: { status: "ganha" },
      include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
      orderBy: { criadoEm: "desc" },
    }),
    db.negociacao.findMany({
      where: { status: { in: ["ganha", "perdida"] } },
      select: { status: true, valor: true, condicaoPagamento: true, maquinaModelo: true },
    }),
  ]);

  const totalFechadas = todas.length;
  const totalGanhas = ganhas.length;
  const totalPerdidas = totalFechadas - totalGanhas;

  // Ticket médio
  const valoresGanhos = ganhas.map((n) => n.valor ?? 0).filter((v) => v > 0);
  const ticketMedio = valoresGanhos.length
    ? valoresGanhos.reduce((a, b) => a + b, 0) / valoresGanhos.length
    : null;
  const totalFaturado = valoresGanhos.reduce((a, b) => a + b, 0);

  // Ranking de modelos mais vendidos
  const contagemModelos: Record<string, { qtd: number; total: number }> = {};
  for (const n of ganhas) {
    const m = n.maquinaModelo ?? "Não informado";
    if (!contagemModelos[m]) contagemModelos[m] = { qtd: 0, total: 0 };
    contagemModelos[m].qtd++;
    contagemModelos[m].total += n.valor ?? 0;
  }
  const rankingModelos = Object.entries(contagemModelos)
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .slice(0, 10);

  // Condições de pagamento
  const contagemCond: Record<string, number> = {};
  for (const n of ganhas) {
    const c = n.condicaoPagamento ?? "outro";
    contagemCond[c] = (contagemCond[c] ?? 0) + 1;
  }
  const rankingCond = Object.entries(contagemCond).sort((a, b) => b[1] - a[1]);

  // Ticket médio por modelo
  const ticketPorModelo: Record<string, { soma: number; qtd: number }> = {};
  for (const n of ganhas) {
    const m = n.maquinaModelo ?? "Não informado";
    if (!ticketPorModelo[m]) ticketPorModelo[m] = { soma: 0, qtd: 0 };
    if (n.valor && n.valor > 0) {
      ticketPorModelo[m].soma += n.valor;
      ticketPorModelo[m].qtd++;
    }
  }
  const ticketModelos = Object.entries(ticketPorModelo)
    .filter(([, v]) => v.qtd > 0)
    .map(([modelo, v]) => ({ modelo, media: v.soma / v.qtd, qtd: v.qtd }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 10);

  const medalha = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);

  return (
    <div>
      <PageHeader
        titulo="Histórico de Negócios"
        subtitulo="Negociações faturadas, condições mais usadas e ticket médio por modelo"
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-green-600">{totalGanhas}</div>
          <div className="mt-1 text-xs text-slate-500">Negócios fechados</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-red-500">{totalPerdidas}</div>
          <div className="mt-1 text-xs text-slate-500">Negócios perdidos</div>
        </Card>
        <Card className="text-center">
          <div className="text-base font-bold leading-tight text-slate-800 sm:text-lg">
            {ticketMedio ? formatCurrency(ticketMedio) : "—"}
          </div>
          <div className="mt-1 text-xs text-slate-500">Ticket médio</div>
        </Card>
        <Card className="text-center">
          <div className="text-base font-bold leading-tight text-brand-700 sm:text-lg">
            {totalFaturado > 0 ? formatCurrency(totalFaturado) : "—"}
          </div>
          <div className="mt-1 text-xs text-slate-500">Total faturado</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Modelos mais vendidos */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Package size={18} className="text-brand-600" /> Modelos mais vendidos
          </div>
          {rankingModelos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {rankingModelos.map(([modelo, { qtd, total }], i) => (
                <div key={modelo} className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm">{medalha(i)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-slate-800">{modelo}</span>
                      <span className="ml-2 shrink-0 text-xs text-slate-500">{qtd} un.</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: pct(qtd, rankingModelos[0][1].qtd) }}
                      />
                    </div>
                    {total > 0 && (
                      <div className="text-[11px] text-slate-400">{formatCurrency(total)} total</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Condições de pagamento */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Banknote size={18} className="text-green-600" /> Condições de pagamento
          </div>
          {rankingCond.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {rankingCond.map(([cond, qtd]) => (
                <div key={cond} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {COND_LABEL[cond] ?? cond}
                      </span>
                      <span className="text-sm font-bold text-slate-800">{pct(qtd, totalGanhas)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          cond === "avista" ? "bg-green-500" :
                          cond === "financiamento" ? "bg-blue-500" :
                          cond === "consorcio" ? "bg-purple-500" : "bg-slate-400"
                        }`}
                        style={{ width: pct(qtd, totalGanhas) }}
                      />
                    </div>
                  </div>
                  <Badge
                    tom={cond === "avista" ? "green" : cond === "financiamento" ? "blue" : cond === "consorcio" ? "blue" : "slate"}
                  >
                    {qtd}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Ticket médio por modelo */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <TrendingUp size={18} className="text-amber-500" /> Ticket médio por modelo
          </div>
          {ticketModelos.length === 0 ? (
            <p className="text-sm text-slate-400">Sem dados de valor nas vendas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-400">
                    <th className="py-2">#</th>
                    <th className="py-2">Modelo</th>
                    <th className="py-2 text-right">Ticket médio</th>
                    <th className="py-2 text-right">Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketModelos.map(({ modelo, media, qtd }, i) => (
                    <tr key={modelo} className="border-b hover:bg-slate-50">
                      <td className="py-2.5 text-slate-400">{medalha(i)}</td>
                      <td className="py-2.5 font-medium text-slate-800">{modelo}</td>
                      <td className="py-2.5 text-right font-bold text-brand-700">{formatCurrency(media)}</td>
                      <td className="py-2.5 text-right text-slate-500">{qtd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Lista de negócios ganhos */}
      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
          <ClipboardList size={18} className="text-slate-500" /> Negócios fechados
        </h2>
        {ganhas.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-slate-400">
              Nenhuma negociação faturada ainda. Vai lá vender! 💪
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {ganhas.map((n) => (
              <Card key={n.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{n.cliente.nome}</span>
                    {n.maquinaModelo && <Badge tom="blue">{n.maquinaModelo}</Badge>}
                  </div>
                  {n.cliente.municipio && (
                    <p className="text-xs text-slate-400">{n.cliente.municipio.nome}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-right">
                  {n.condicaoPagamento && (
                    <Badge tom="slate">{COND_LABEL[n.condicaoPagamento] ?? n.condicaoPagamento}</Badge>
                  )}
                  {n.valor ? (
                    <span className="font-bold text-green-600">{formatCurrency(n.valor)}</span>
                  ) : (
                    <span className="text-sm text-slate-400">valor não informado</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
