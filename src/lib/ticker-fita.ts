// A FITA DO RODAPÉ — regra pura de montagem (sem React, sem rede).
//
//   "quero que a cada 3 cotações de algum ativo venha uma notícia, concluindo
//    a notícia, mais 3 cotações atuais de outros ativos, e assim
//    sucessivamente"
//
// É o ritmo de letreiro de canal de negócios: o preço passa, a manchete
// interrompe, o preço volta com OUTROS papéis. Fica aqui, separado da tela,
// porque é a única parte com regra de verdade — o resto é CSS correndo.

import type { CotacoesMercado } from "@/lib/mercado";

export type CotacaoFita = {
  /** Identidade do ativo (para a chave do React e para não repetir na mesma volta). */
  chave: string;
  rotulo: string;
  valor: string;
  /** Variação do dia em %. null quando a fonte não informa. */
  pct: number | null;
  sub?: string | null;
  /** Nenhuma fonte respondeu: o letreiro DIZ que falta, em vez de sumir com o ativo. */
  falta?: boolean;
};

export type NoticiaFita = {
  titulo: string;
  tema: string;
  fonte: string | null;
  link: string;
};

export type ItemFita =
  | ({ tipo: "cotacao" } & CotacaoFita)
  | ({ tipo: "noticia" } & NoticiaFita);

/** O pedido do vendedor, em número. */
export const COTACOES_POR_NOTICIA = 3;

const fmtBRL = (v: number, casas = 2) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
export const TEXTO_FALTA = "indisponível";

/**
 * As cotações do letreiro — AS MESMAS dos cartões do topo do Dashboard.
 *
 *   "os valores do letreiro de cima que mantemos sempre atualizado não está
 *    refletindo no letreiro de baixo, corrija"
 *
 * A régua é uma só, e é a mesma do cartão: preço do ES quando existe, bolsa só
 * como reserva quando o ES não veio. O que o vendedor lê em cima é exatamente
 * o que passa embaixo.
 *
 *   "no letreiro está repetindo o valor do café conilon, antes era o dolar"
 *
 * Ativo sem leitura sumia da lista; com dois ativos, o rodízio de três
 * repetia o café no lugar do dólar — parecia valor errado, não falta. Agora os
 * três lugares ficam sempre, e o que não veio aparece como "indisponível".
 * Nenhum dos três veio: lista vazia (o letreiro passa só as notícias).
 */
export function cotacoesDaFita(c: CotacoesMercado): CotacaoFita[] {
  const es = c.cafeES ?? null;
  const falta = (chave: string, rotulo: string): CotacaoFita => ({ chave, rotulo, valor: TEXTO_FALTA, pct: null, falta: true });
  const lista: CotacaoFita[] = [];

  if (es?.arabica != null) lista.push({ chave: "arabica-es", rotulo: "Arábica ES", valor: fmtBRL(es.arabica), pct: es.variacaoArabicaPct ?? null });
  else if (c.cafeArabica != null) lista.push({ chave: "arabica-ny", rotulo: "Arábica NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct ?? null });
  else lista.push(falta("arabica", "Arábica"));

  if (es?.conilon != null) lista.push({ chave: "conilon-es", rotulo: "Conilon ES", valor: fmtBRL(es.conilon), pct: es.variacaoConilonPct ?? null });
  else if (c.cafeConilon != null) lista.push({ chave: "conilon-ldn", rotulo: "Conilon Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct ?? null });
  else lista.push(falta("conilon", "Conilon"));

  const dolar = es?.dolar ?? c.dolar;
  if (dolar != null) lista.push({ chave: "dolar", rotulo: "Dólar", valor: fmtBRL(dolar), pct: es?.dolar != null ? null : c.detalhe?.dolar?.variacaoPct ?? null });
  else lista.push(falta("dolar", "Dólar"));

  return lista.every((x) => x.falta) ? [] : lista;
}

/**
 * Intercala cotações e notícias no ritmo pedido.
 *
 * As cotações são percorridas em RODÍZIO CONTÍNUO: o segundo grupo começa de
 * onde o primeiro parou, então ele traz outros ativos — que é o "mais 3
 * cotações atuais de outros ativos". Com menos ativos que o tamanho do grupo,
 * o grupo encolhe: o mesmo ativo duas vezes no mesmo grupo lia como valor
 * errado no lugar do outro.
 *
 * Sem notícia nenhuma, a fita é só de cotações (e vice-versa): o letreiro
 * nunca fica vazio por causa de uma das duas fontes ter falhado.
 */
export function montarFita(
  cotacoes: CotacaoFita[],
  noticias: NoticiaFita[],
  porGrupo: number = COTACOES_POR_NOTICIA,
): ItemFita[] {
  const passo = Math.min(Math.max(1, Math.floor(porGrupo)), Math.max(1, cotacoes.length));
  if (!cotacoes.length && !noticias.length) return [];
  if (!cotacoes.length) return noticias.map((n) => ({ tipo: "noticia", ...n }));
  if (!noticias.length) return cotacoes.map((c) => ({ tipo: "cotacao", ...c }));

  const fita: ItemFita[] = [];
  let i = 0;
  for (const n of noticias) {
    for (let k = 0; k < passo; k++) {
      fita.push({ tipo: "cotacao", ...cotacoes[i % cotacoes.length] });
      i++;
    }
    fita.push({ tipo: "noticia", ...n });
  }
  return fita;
}

/**
 * Quanto tempo a fita leva para passar inteira.
 *
 * Proporcional ao texto (~55 px/s dá uma leitura confortável em pé, no
 * celular, no meio da rua). Piso de 40 s para fita curta não sair correndo.
 */
export function duracaoDaFita(itens: ItemFita[]): number {
  const chars = itens.reduce((s, it) => s + (it.tipo === "noticia" ? it.titulo.length + 24 : it.rotulo.length + it.valor.length + 14), 0);
  return Math.max(40, Math.round((chars * 8.5) / 55));
}
