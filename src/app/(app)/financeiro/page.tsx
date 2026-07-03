import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { formatCurrency, formatDate, apos5DiaUtilBrasilia, mesAnoAtualBrasilia } from "@/lib/utils";
import Link from "next/link";
import {
  DollarSign, TrendingUp, Award, BarChart3,
  Handshake, CheckCircle2, Clock, ChevronRight,
} from "lucide-react";
import { FinanceiroGraficos } from "@/components/FinanceiroGraficos";
import { ComissoesPagasSection } from "@/components/ComissoesPagasSection";
import { PopupComissoesPendentes } from "@/components/PopupComissoesPendentes";

export const dynamic = "force-dynamic";

const TAXA_COMISSAO = 0.005; // 0.5%

function calcComissao(valor: number | null) {
  return (valor ?? 0) * TAXA_COMISSAO;
}

// Calcula previsão de pagamento da comissão CRD PME:
// Comissão paga quando 75% do valor da máquina for pago (entrada + parcelas).
function previsaoComissaoCrdPme(neg: {
  faturadoEm: Date | null;
  valor: number | null;
  entradaValor?: number | null;
  crdSaldoParcelasQtd?: number | null;
  crdParcelaValor?: number | null;
}): Date | null {
  if (!neg.faturadoEm || !neg.valor) return null;
  const alvo75 = neg.valor * 0.75;
  const entrada = (neg as any).entradaValor ?? 0;
  const qtd = (neg as any).crdSaldoParcelasQtd ?? 0;
  const parcela = (neg as any).crdParcelaValor ?? 0;
  let pago = entrada;
  let meses = 0;
  while (pago < alvo75 && meses < qtd) {
    pago += parcela;
    meses++;
  }
  const dt = new Date(neg.faturadoEm);
  dt.setMonth(dt.getMonth() + meses);
  return dt;
}

export default async function FinanceiroPage() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0-indexed

  // Busca todas as negociações faturadas (na coluna FATURADO ou status ganha)
  const negFaturadas = await db.negociacao.findMany({
    where: {
      OR: [
        { estagio: { contains: "faturad", mode: "insensitive" } },
        { status: "ganha", faturadoEm: { not: null } },
      ],
    },
    include: { cliente: true },
    orderBy: { faturadoEm: "desc" },
  } as any);

  // Negociações abertas (para forecast)
  const negAbertas = await db.negociacao.findMany({
    where: { status: "aberta" },
    include: { cliente: true },
    orderBy: { atualizadoEm: "desc" },
  });

  // Negociações antigas (campo negociacaoAntiga)
  const todasGanhas = await db.negociacao.findMany({
    where: { status: "ganha" },
    include: { cliente: true },
    orderBy: { faturadoEm: "desc" },
  } as any);

  // KPIs
  const totalFaturado = todasGanhas.reduce((s: number, n: any) => s + (n.valor ?? 0), 0);
  // "Comissões a Receber" = apenas as que ainda NÃO foram marcadas como pagas.
  const pendentesComissao = todasGanhas.filter((n: any) => !n.comissaoPaga);
  const comissaoTotal = pendentesComissao.reduce((s: number, n: any) => s + calcComissao(n.valor), 0);

  // Pop-up do 5º dia útil do mês: lista as comissões pendentes para confirmação de pagamento.
  const mesReferenciaPagamento = mesAnoAtualBrasilia();
  const pendentesPopup = pendentesComissao.map((n: any) => ({
    id: n.id,
    clienteNome: n.cliente.nome,
    maquina: n.maquinaModelo ?? null,
    valor: n.valor ?? 0,
    comissao: calcComissao(n.valor),
  }));
  const mostrarPopupComissoes = apos5DiaUtilBrasilia() && pendentesPopup.length > 0;

  // Comissões deste mês (faturadas este mês)
  const inicioMes = new Date(anoAtual, mesAtual, 1);
  const fimMes = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59);
  const faturadasMes = todasGanhas.filter((n: any) => {
    const dt = n.faturadoEm ?? n.atualizadoEm;
    return dt >= inicioMes && dt <= fimMes;
  });
  const faturadoMes = faturadasMes.reduce((s: number, n: any) => s + (n.valor ?? 0), 0);
  const comissaoMes = calcComissao(faturadoMes);

  // Comissões do próximo mês (faturadas com mesAnoReferencia do próximo mês)
  const proxMesDate = new Date(anoAtual, mesAtual + 1, 1);
  const proxMesStr = proxMesDate.toISOString().slice(0, 7);
  const faturadasProxMes = todasGanhas.filter((n: any) =>
    n.mesAnoReferencia === proxMesStr
  );
  const comissaoProxMes = calcComissao(
    faturadasProxMes.reduce((s: number, n: any) => s + (n.valor ?? 0), 0)
  );

  // Comissões futuras CRD PME (pagas quando 75% do valor for pago)
  const negCrdPme = todasGanhas.filter((n: any) => n.tipoPagamento === "crd_pme");
  const comissoesFuturas = negCrdPme.map((n: any) => ({
    id: n.id,
    cliente: n.cliente.nome,
    maquina: n.maquinaModelo ?? "?",
    valor: n.valor ?? 0,
    comissao: calcComissao(n.valor),
    previsaoPagamento: previsaoComissaoCrdPme(n),
    faturadoEm: n.faturadoEm,
  }));
  const totalComissoesFuturas = comissoesFuturas.reduce((s, c) => s + c.comissao, 0);

  // Receita por mês (2025 e 2026) — agrupado por mesAnoReferencia ou faturadoEm
  const mesesRelatorio: Record<string, { valor: number; negs: any[] }> = {};
  for (const n of todasGanhas as any[]) {
    const ref =
      (n.mesAnoReferencia as string | null) ??
      (n.faturadoEm ? (n.faturadoEm as Date).toISOString().slice(0, 7) : null) ??
      (n.atualizadoEm as Date).toISOString().slice(0, 7);
    if (!mesesRelatorio[ref]) mesesRelatorio[ref] = { valor: 0, negs: [] };
    mesesRelatorio[ref].valor += n.valor ?? 0;
    mesesRelatorio[ref].negs.push(n);
  }

  // Gerar lista de meses para 2025 e 2026 até o mês atual
  const mesesLabels: string[] = [];
  for (let y = 2025; y <= anoAtual; y++) {
    const limMes = y < anoAtual ? 11 : mesAtual;
    for (let m = 0; m <= limMes; m++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      mesesLabels.push(key);
    }
  }

  const receitaMensal = mesesLabels.map((key) => ({
    key,
    label: new Date(key + "-15")
      .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .toUpperCase(),
    valor: mesesRelatorio[key]?.valor ?? 0,
    comissao: calcComissao(mesesRelatorio[key]?.valor ?? 0),
    negs: mesesRelatorio[key]?.negs ?? [],
  }));

  // ── Comissões Pagas (por ano/período) ───────────────────────────────────────
  // Agrupar SOMENTE as comissões efetivamente confirmadas como pagas (comissaoPaga=true),
  // pelo ano do mês de pagamento informado.
  const comissoesPagasPorAno: Record<string, {
    total: number;
    quantidade: number;
    negs: Array<{ clienteNome: string; clienteId: string; valor: number; comissao: number; faturadoEm: Date | null; maquina: string }>;
  }> = {};

  const comissoesPagas = (todasGanhas as any[]).filter((n) => n.comissaoPaga);
  for (const n of comissoesPagas) {
    const ano = n.comissaoPagaMes
      ? n.comissaoPagaMes.slice(0, 4)
      : n.comissaoPagaEm
      ? new Date(n.comissaoPagaEm).getFullYear().toString()
      : "desconhecido";
    if (!comissoesPagasPorAno[ano]) comissoesPagasPorAno[ano] = { total: 0, quantidade: 0, negs: [] };
    const comissao = calcComissao(n.valor);
    comissoesPagasPorAno[ano].total += comissao;
    comissoesPagasPorAno[ano].quantidade += 1;
    comissoesPagasPorAno[ano].negs.push({
      clienteNome: n.cliente.nome,
      clienteId: n.clienteId,
      valor: n.valor ?? 0,
      comissao,
      faturadoEm: n.faturadoEm,
      maquina: n.maquinaModelo ?? "?",
    });
  }

  const anosComissoes = Object.keys(comissoesPagasPorAno).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <PopupComissoesPendentes
        pendentes={pendentesPopup}
        mostrar={mostrarPopupComissoes}
        mesReferencia={mesReferenciaPagamento}
      />
      <PageHeader
        titulo="Financeiro & Comissões"
        subtitulo={`Taxa de comissão: ${(TAXA_COMISSAO * 100).toFixed(1)}% sobre valor negociado`}
      />

      {/* KPIs hero — todos clicáveis */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/financeiro/faturadas">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 hover:shadow-md hover:border-green-400 transition-all cursor-pointer group">
            <div className="mb-2 text-green-600"><Award size={20} /></div>
            <div className="text-xs text-slate-500 mb-1">Negociações Faturadas</div>
            <div className="text-xl font-bold text-green-700">{todasGanhas.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">{formatCurrency(totalFaturado)}</div>
            <div className="text-xs text-green-600 group-hover:underline mt-1 flex items-center gap-1">Ver relação <ChevronRight size={12} /></div>
          </div>
        </Link>
        <Link href="/financeiro/valor-maquinas">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group">
            <div className="mb-2 text-blue-600"><Handshake size={20} /></div>
            <div className="text-xs text-slate-500 mb-1">Valor Máquinas Vendidas</div>
            <div className="text-xl font-bold text-blue-700">{formatCurrency(totalFaturado)}</div>
            <div className="text-xs text-slate-400 mt-0.5">{todasGanhas.length} máquina(s)</div>
            <div className="text-xs text-blue-600 group-hover:underline mt-1 flex items-center gap-1">Ver relação <ChevronRight size={12} /></div>
          </div>
        </Link>
        <Link href="/financeiro/comissoes">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group">
            <div className="mb-2 text-emerald-600"><DollarSign size={20} /></div>
            <div className="text-xs text-slate-500 mb-1">Comissões a Receber</div>
            <div className="text-xl font-bold text-emerald-700">{formatCurrency(comissaoTotal)}</div>
            <div className="text-xs text-slate-400 mt-0.5">{pendentesComissao.length} negociação(ões) ainda não pagas</div>
            <div className="text-xs text-emerald-600 group-hover:underline mt-1 flex items-center gap-1">Ver relação <ChevronRight size={12} /></div>
          </div>
        </Link>
        <Link href="/financeiro/comissoes-futuras">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group">
            <div className="mb-2 text-amber-600"><Clock size={20} /></div>
            <div className="text-xs text-slate-500 mb-1">Comissões Futuras (CRD PME)</div>
            <div className="text-xl font-bold text-amber-700">{formatCurrency(totalComissoesFuturas)}</div>
            <div className="text-xs text-slate-400 mt-0.5">{negCrdPme.length} negoc. CRD PME</div>
            <div className="text-xs text-amber-600 group-hover:underline mt-1 flex items-center gap-1">Ver relação <ChevronRight size={12} /></div>
          </div>
        </Link>
      </div>

      {/* Receita Mensal com seletor de ano */}
      <div className="mb-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <BarChart3 size={17} className="text-brand-500" />
              Receita mensal
            </div>
          </div>
          <FinanceiroGraficos receitaMensal={receitaMensal} />
        </Card>
      </div>

      {/* ── Comissões Pagas por Período ── */}
      <div className="mb-6">
        <ComissoesPagasSection
          anosComissoes={anosComissoes}
          comissoesPagasPorAno={comissoesPagasPorAno}
        />
      </div>

      {/* Grid: Faturadas recentes + Comissões Futuras */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Faturadas recentes */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <CheckCircle2 size={17} className="text-green-500" /> Faturadas recentes
            </div>
            <Link href="/financeiro/faturadas" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todas <ChevronRight size={12} />
            </Link>
          </div>
          {todasGanhas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma venda registrada.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {(todasGanhas as any[]).slice(0, 8).map((n: any) => (
                <li key={n.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-green-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/clientes/${n.clienteId}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-600">
                      {n.cliente.nome}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {n.maquinaModelo ?? "Sem modelo"} · {n.faturadoEm ? formatDate(n.faturadoEm) : formatDate(n.atualizadoEm)}
                      {n.tipoPagamento === "crd_pme" && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700 font-bold">CRD PME</span>}
                    </p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="text-sm font-bold text-slate-800">{formatCurrency(n.valor)}</div>
                    <div className="text-xs text-emerald-600">+{formatCurrency(calcComissao(n.valor))}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Comissões Futuras CRD PME */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <Clock size={17} className="text-amber-500" /> Comissões Futuras (CRD PME)
            </div>
            <Link href="/financeiro/comissoes-futuras" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todas <ChevronRight size={12} />
            </Link>
          </div>
          {comissoesFuturas.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma negociação CRD PME registrada.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {comissoesFuturas.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="block truncate text-sm font-semibold text-slate-800">{c.cliente}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.maquina} · Faturado: {c.faturadoEm ? formatDate(c.faturadoEm) : "?"}
                    </p>
                    {c.previsaoPagamento && (
                      <p className="text-xs text-amber-700 font-semibold">
                        Previsão comissão: {formatDate(c.previsaoPagamento)}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="text-sm font-bold text-slate-800">{formatCurrency(c.valor)}</div>
                    <div className="text-xs text-amber-700 font-bold">+{formatCurrency(c.comissao)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
