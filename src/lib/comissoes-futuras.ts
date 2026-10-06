// COMISSÕES FUTURAS — toda venda faturada cuja comissão ainda está pendente
// (sem "mês pago" em Negociações Faturadas), de QUALQUER forma de pagamento.
//
// 06/10, print dele: "as vendas faturadas e que não têm ainda mês em que as
// comissões estão ainda pendentes não estão gerando o relatório de comissões
// futuras". A tela e o card do Financeiro filtravam só CRD PME — com as
// faturadas à vista, financiadas ou no consórcio pendentes, o relatório
// mostrava 0 negociações e R$ 0.
//
// O CRD PME continua com a previsão própria (a comissão sai quando 75% do
// valor da máquina estiver pago: entrada + boletos de 30 em 30 dias). Para as
// outras formas não há regra de data no CRM — a linha diz há quanto tempo
// está pendente, sem inventar previsão.
//
// Puro (sem banco): usado pela tela /financeiro/comissoes-futuras e pelo
// Financeiro; testado em tests/comissoes-futuras.test.ts.

export type NegociacaoComissao = {
  status: string;
  comissaoPaga: boolean;
  tipoPagamento?: string | null;
  valor: number | null;
  faturadoEm: Date | null;
  atualizadoEm?: Date | null;
  entradaValor?: number | null;
  crdSaldoParcelasQtd?: number | null;
  crdParcelaValor?: number | null;
};

export const ROTULO_PAGAMENTO_COMISSAO: Record<string, string> = {
  avista: "À vista",
  financiamento: "Financiamento",
  consorcio: "Consórcio",
  crd_pme: "CRD PME",
  outro: "Outro",
};

/** Faturada e com a comissão ainda não marcada como paga. */
export function comissaoPendente(n: Pick<NegociacaoComissao, "status" | "comissaoPaga">): boolean {
  return n.status === "ganha" && !n.comissaoPaga;
}

/**
 * CRD PME: a comissão sai quando 75% do valor da máquina estiver pago
 * (entrada + parcelas de boleto, de 30 em 30 dias a partir do faturamento).
 */
export function previsaoComissaoCrdPme(n: Pick<NegociacaoComissao, "faturadoEm" | "valor" | "entradaValor" | "crdSaldoParcelasQtd" | "crdParcelaValor">): { data: Date | null; meses: number } {
  if (!n.faturadoEm || !n.valor) return { data: null, meses: 0 };
  const alvo75 = n.valor * 0.75;
  const qtd = n.crdSaldoParcelasQtd ?? 0;
  const parcela = n.crdParcelaValor ?? 0;
  let pago = n.entradaValor ?? 0;
  let meses = 0;
  while (pago < alvo75 && meses < qtd) {
    pago += parcela;
    meses++;
  }
  const data = new Date(n.faturadoEm);
  data.setMonth(data.getMonth() + meses);
  return { data, meses };
}

export type SituacaoComissao =
  | { tipo: "aguardando"; diasPendente: number | null }        // à vista, financiamento, consórcio…
  | { tipo: "crd_aguarda_75"; previsao: Date; meses: number }   // CRD PME, 75% ainda não pago
  | { tipo: "crd_75_atingido"; previsao: Date; meses: number }  // CRD PME, a data dos 75% já passou
  | { tipo: "crd_sem_dados" };                                  // CRD PME sem faturamento/valor

export function situacaoComissao(n: NegociacaoComissao, hoje: Date = new Date()): SituacaoComissao {
  if (n.tipoPagamento === "crd_pme") {
    const { data, meses } = previsaoComissaoCrdPme(n);
    if (!data) return { tipo: "crd_sem_dados" };
    return data > hoje ? { tipo: "crd_aguarda_75", previsao: data, meses } : { tipo: "crd_75_atingido", previsao: data, meses };
  }
  const desde = n.faturadoEm ?? n.atualizadoEm ?? null;
  return { tipo: "aguardando", diasPendente: desde ? Math.max(0, Math.floor((hoje.getTime() - desde.getTime()) / 86_400_000)) : null };
}

/** Linhas do relatório: só as pendentes, a mais antiga primeiro (é a que mais espera). */
export function comissoesFuturas<T extends NegociacaoComissao>(negs: T[], taxa: number, hoje: Date = new Date()): (T & { comissao: number; situacao: SituacaoComissao })[] {
  const quando = (n: NegociacaoComissao) => (n.faturadoEm ?? n.atualizadoEm ?? new Date(0)).getTime();
  return negs
    .filter(comissaoPendente)
    .map((n) => ({ ...n, comissao: (n.valor ?? 0) * taxa, situacao: situacaoComissao(n, hoje) }))
    .sort((a, b) => quando(a) - quando(b));
}
