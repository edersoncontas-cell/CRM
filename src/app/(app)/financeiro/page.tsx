import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatCurrency, formatDate, diasDesde } from "@/lib/utils";
import { forecastValor, comissaoEstimada, TAXA_COMISSAO, PROB_ESTAGIO } from "@/lib/insights";
import { ESTAGIOS } from "@/lib/pipeline";
import Link from "next/link";
import {
  DollarSign, TrendingUp, Percent, Award, ArrowRight,
  BarChart3, Handshake, Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const [negociacoesAbertas, negociacoesGanhas, negociacoesPerdidas] = await Promise.all([
    db.negociacao.findMany({
      where: { status: "aberta" },
      include: { cliente: true },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.negociacao.findMany({
      where: { status: "ganha" },
      include: { cliente: true },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.negociacao.findMany({
      where: { status: "perdida" },
      include: { cliente: true },
      orderBy: { atualizadoEm: "desc" },
    }),
  ]);

  // Receita confirmada (ganha)
  const receitaConfirmada = negociacoesGanhas.reduce((s, n) => s + (n.valor ?? 0), 0);
  const comissaoRealizada = comissaoEstimada(receitaConfirmada);

  // Forecast (pipeline aberto ponderado por estágio)
  const forecast = forecastValor(negociacoesAbertas);
  const comissaoEstim = comissaoEstimada(forecast);

  // Valor total no pipeline (sem ponderação)
  const valorPipeline = negociacoesAbertas.reduce((s, n) => s + (n.valor ?? 0), 0);

  // Valor perdido
  const valorPerdido = negociacoesPerdidas.reduce((s, n) => s + (n.valor ?? 0), 0);

  // Por estágio
  const porEstagio = ESTAGIOS.map((e) => {
    const negs = negociacoesAbertas.filter((n) => n.estagio === e.id);
    const valor = negs.reduce((s, n) => s + (n.valor ?? 0), 0);
    const prob = PROB_ESTAGIO[e.id] ?? 0;
    return { ...e, count: negs.length, valor, prob, forecast: valor * prob };
  }).filter((e) => e.count > 0);

  // Receita por modelo de máquina (ganha)
  const porModelo: Record<string, { count: number; valor: number }> = {};
  for (const n of negociacoesGanhas) {
    const key = n.maquinaModelo ?? "Sem modelo";
    if (!porModelo[key]) porModelo[key] = { count: 0, valor: 0 };
    porModelo[key].count++;
    porModelo[key].valor += n.valor ?? 0;
  }
  const topModelos = Object.entries(porModelo)
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, 8);

  // Receita mensal (últimos 6 meses — ganha)
  const hoje = new Date();
  const meses: { label: string; valor: number; comissao: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0, 23, 59, 59);
    const negs = negociacoesGanhas.filter((n) => {
      const at = n.atualizadoEm;
      return at >= d && at <= fim;
    });
    const valor = negs.reduce((s, n) => s + (n.valor ?? 0), 0);
    meses.push({
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      valor,
      comissao: comissaoEstimada(valor),
    });
  }

  const maxMes = Math.max(...meses.map((m) => m.valor), 1);

  return (
    <div>
      <PageHeader
        titulo="Financeiro & Comissões"
        subtitulo={`Taxa de comissão: ${TAXA_COMISSAO}% sobre valor negociado`}
      />

      {/* KPIs hero */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icone={<Award size={20} />}
          rotulo="Receita confirmada"
          valor={formatCurrency(receitaConfirmada)}
          sub={`${negociacoesGanhas.length} venda(s) fechada(s)`}
          cor="green"
        />
        <KpiCard
          icone={<Percent size={20} />}
          rotulo={`Comissão realizada (${TAXA_COMISSAO}%)`}
          valor={formatCurrency(comissaoRealizada)}
          sub="Sobre receita confirmada"
          cor="emerald"
        />
        <KpiCard
          icone={<TrendingUp size={20} />}
          rotulo="Forecast ponderado"
          valor={formatCurrency(forecast)}
          sub={`Pipeline total: ${formatCurrency(valorPipeline)}`}
          cor="blue"
        />
        <KpiCard
          icone={<DollarSign size={20} />}
          rotulo="Comissão estimada"
          valor={formatCurrency(comissaoEstim)}
          sub="Se o forecast se confirmar"
          cor="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gráfico mensal */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <BarChart3 size={17} className="text-brand-500" /> Receita mensal (últimos 6 meses)
          </div>
          <div className="space-y-2">
            {meses.map((m) => {
              const pct = maxMes > 0 ? (m.valor / maxMes) * 100 : 0;
              return (
                <div key={m.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 uppercase tracking-wide">{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{formatCurrency(m.valor)}</span>
                      <span className="font-semibold text-emerald-600">
                        +{formatCurrency(m.comissao)} comis.
                      </span>
                    </div>
                  </div>
                  <div className="h-5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {meses.every((m) => m.valor === 0) && (
            <p className="mt-4 text-sm text-slate-400">Nenhuma venda ganha nos últimos 6 meses.</p>
          )}
        </Card>

        {/* Por estágio */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Clock size={17} className="text-amber-500" /> Pipeline por estágio
          </div>
          {porEstagio.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma negociação aberta.</p>
          ) : (
            <div className="space-y-2.5">
              {porEstagio.map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{e.titulo}</span>
                    <Badge tom="blue">{e.count}</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatCurrency(e.valor)}</span>
                    <span className="text-emerald-600 font-semibold">
                      ~{formatCurrency(e.forecast)} ({Math.round(e.prob * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top modelos */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Handshake size={17} className="text-brand-500" /> Receita por modelo (vendas fechadas)
          </div>
          {topModelos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma venda registrada.</p>
          ) : (
            <div className="space-y-2">
              {topModelos.map(([modelo, { count, valor }]) => (
                <div key={modelo} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-700">{modelo}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{count}x</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(valor)}</span>
                    <span className="text-xs text-emerald-600">+{formatCurrency(comissaoEstimada(valor))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Vendas fechadas recentes */}
        <Card>
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
            <Award size={17} className="text-green-500" /> Vendas fechadas recentes
          </div>
          {negociacoesGanhas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma venda registrada ainda.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {negociacoesGanhas.slice(0, 12).map((n) => (
                <li key={n.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-green-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/clientes/${n.clienteId}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-600">
                      {n.cliente.nome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {n.maquinaModelo ?? "Sem modelo"} · {formatDate(n.atualizadoEm)}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="text-sm font-bold text-slate-800">{formatCurrency(n.valor)}</div>
                    <div className="text-xs text-emerald-600">+{formatCurrency(comissaoEstimada(n.valor ?? 0))}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Valor perdido */}
      {negociacoesPerdidas.length > 0 && (
        <div className="mt-6">
          <Card>
            <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
              <span className="text-red-500">⚠</span> Oportunidades perdidas
              <span className="ml-auto text-xs text-slate-400">Valor total: {formatCurrency(valorPerdido)}</span>
              <Link href="/vendas-perdidas" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                Ver detalhes <ArrowRight size={12} />
              </Link>
            </div>
            <p className="text-sm text-slate-600">
              {negociacoesPerdidas.length} negociação(ões) perdida(s) · potencial não realizado de{" "}
              <b>{formatCurrency(valorPerdido)}</b>{" "}
              <span className="text-red-500">(comissão não recebida: {formatCurrency(comissaoEstimada(valorPerdido))})</span>
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icone, rotulo, valor, sub, cor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  sub: string;
  cor: "green" | "emerald" | "blue" | "amber";
}) {
  const cores = {
    green: { bg: "bg-green-50", borda: "border-green-200", icone: "text-green-600", valor: "text-green-700" },
    emerald: { bg: "bg-emerald-50", borda: "border-emerald-200", icone: "text-emerald-600", valor: "text-emerald-700" },
    blue: { bg: "bg-blue-50", borda: "border-blue-200", icone: "text-blue-600", valor: "text-blue-700" },
    amber: { bg: "bg-amber-50", borda: "border-amber-200", icone: "text-amber-600", valor: "text-amber-700" },
  }[cor];

  return (
    <div className={`rounded-2xl border p-4 ${cores.bg} ${cores.borda}`}>
      <div className={`mb-2 ${cores.icone}`}>{icone}</div>
      <div className="text-xs text-slate-500 mb-1">{rotulo}</div>
      <div className={`text-xl font-bold ${cores.valor}`}>{valor}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
