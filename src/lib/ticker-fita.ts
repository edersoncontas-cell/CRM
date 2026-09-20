// A FITA DO RODAPÉ — regra pura de montagem (sem React, sem rede).
//
//   "quero que a cada 3 cotações de algum ativo venha uma notícia, concluindo
//    a notícia, mais 3 cotações atuais de outros ativos, e assim
//    sucessivamente"
//
// É o ritmo de letreiro de canal de negócios: o preço passa, a manchete
// interrompe, o preço volta com OUTROS papéis. Fica aqui, separado da tela,
// porque é a única parte com regra de verdade — o resto é CSS correndo.

export type CotacaoFita = {
  /** Identidade do ativo (para a chave do React e para não repetir na mesma volta). */
  chave: string;
  rotulo: string;
  valor: string;
  /** Variação do dia em %. null quando a fonte não informa. */
  pct: number | null;
  sub?: string | null;
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

/**
 * Intercala cotações e notícias no ritmo pedido.
 *
 * As cotações são percorridas em RODÍZIO CONTÍNUO: o segundo grupo começa de
 * onde o primeiro parou, então ele traz outros ativos — que é o "mais 3
 * cotações atuais de outros ativos". Com menos ativos que o tamanho do grupo
 * não há "outros" possíveis, e aí eles repetem mesmo; é limite do dado, não
 * da regra.
 *
 * Sem notícia nenhuma, a fita é só de cotações (e vice-versa): o letreiro
 * nunca fica vazio por causa de uma das duas fontes ter falhado.
 */
export function montarFita(
  cotacoes: CotacaoFita[],
  noticias: NoticiaFita[],
  porGrupo: number = COTACOES_POR_NOTICIA,
): ItemFita[] {
  const passo = Math.max(1, Math.floor(porGrupo));
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
