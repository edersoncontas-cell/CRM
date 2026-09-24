// DE QUANTO EM QUANTO TEMPO AS TELAS SE ATUALIZAM SOZINHAS.
//
// Por que existe: quatro componentes tinham setInterval de 60 s que continuava
// rodando com a aba em segundo plano. Cada volta chamava uma rota que consulta
// o banco — e com uma chamada por minuto, 24 horas por dia, o banco do Neon
// nunca suspendia. Foi isso que estourou a cota grátis de computação e deixou
// o CRM fora do ar em 23/09/2026. Ver docs/consumo-invocacoes.md.
//
// Além do intervalo maior, todo setInterval que chama o servidor confere
// document.visibilityState antes: aba escondida, celular bloqueado ou app em
// segundo plano não geram chamada nenhuma. Ao voltar para a tela, os
// listeners de focus/visibilitychange (que continuam lá) buscam na hora.
//
// Módulo puro: pode ser importado por tela de servidor e de cliente.

/** Letreiro de cotações e notícias (RodapeMercado e TickerMercado). */
export const INTERVALO_MERCADO = 15 * 60_000;

/** Contador de alertas no menu lateral (Sidebar). */
export const INTERVALO_ALERTAS = 10 * 60_000;

/** Pontos do mapa de vendas do Dashboard (MapaVendasES). */
export const INTERVALO_MAPA_VENDAS = 10 * 60_000;
