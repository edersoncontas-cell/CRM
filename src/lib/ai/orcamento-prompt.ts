// De que tamanho o pedido pode ser, para caber no provedor que vai atendê-lo.
//
// "Ainda está dando erro por conta de limite, que limite é esse? Você consegue
//  resolver isso ou não?"
//
// Consigo, e a causa é aritmética. A análise do Orientador mandava:
//
//   histórico   120.000 caracteres
//   prompt       12.000
//   contexto      6.000
//   ------------------------
//   TOTAL       138.000 caracteres  ≈  34.500 tokens de entrada
//
// E o limite POR MINUTO da camada gratuita do Groq, por modelo, é:
//
//   openai/gpt-oss-120b        8.000 tokens/min
//   llama-3.3-70b-versatile   12.000 tokens/min
//   llama-3.1-8b-instant       6.000 tokens/min
//
// Ou seja: o pedido era QUATRO A SEIS VEZES MAIOR que o teto do minuto. Ele
// não "estourava a cota" por uso excessivo — ele NUNCA COUBE. Nenhuma espera
// resolvia, porque o problema não era o relógio: era o tamanho. O CRM tentava
// os nove modelos, tomava 429 em todos, e dizia "volta em 1 minuto" — e um
// minuto depois acontecia exatamente a mesma coisa, para sempre.
//
// A janela de 120 mil nasceu de um pedido legítimo ("a IA tem de ler a
// conversa inteira, não só o fim") e está certa para o Gemini, cuja janela é
// de 1 milhão de tokens e cujo limite gratuito é generoso. O erro foi aplicar
// o mesmo tamanho a um provedor cujo teto por minuto é 6 mil.
//
// Então a janela passa a depender de QUEM vai atender. Com Gemini configurado,
// continua grande. Só com Groq gratuito, encolhe para caber — e encolher é
// melhor que falhar: o recorte guarda as duas pontas da conversa (ver
// historico-janela.ts), enquanto 34.500 tokens entregam zero análise.
//
// Módulo puro, com teste.

import type { ProvedorId } from "@/lib/ai/provedores-status";

/** ~4 caracteres por token em português. Conservador de propósito. */
export const CHARS_POR_TOKEN = 4;

/**
 * Teto de tokens de ENTRADA que dá para usar em cada provedor, por chamada.
 *
 * Para o Groq é o menor TPM da camada gratuita entre os modelos candidatos,
 * porque o rodízio pode cair em qualquer um deles. Os outros são pagos ou têm
 * limite alto o bastante para não valer a pena apertar.
 */
export const TETO_ENTRADA: Record<ProvedorId, number> = {
  gemini: 120_000,   // janela de 1M; o limite gratuito é por pedidos, não por tokens
  groq: 12_000,      // TPM do melhor modelo gratuito que ainda comporta o pedido
  deepseek: 60_000,
  openai: 100_000,
  anthropic: 150_000,
};

/**
 * O que o pedido ocupa ALÉM do histórico: o prompt de instruções mais o
 * contexto do cliente.
 *
 * Medido, não chutado: montarPromptOrientador com tudo vazio dá 21.833
 * caracteres — 5.439 tokens só de instrução, porque o contrato JSON do
 * Orientador tem 15 campos e as regras críticas. Somando o contexto do
 * cliente, 22 mil é o piso realista.
 *
 * Este número é o que torna o Groq gratuito apertado: 5.439 tokens de
 * instrução mais a resposta já consomem quase todo o teto por minuto dos
 * modelos menores, e nos de 6.000 TPM não sobra histórico nenhum.
 */
export const RESERVA_PROMPT_CHARS = 22_000;
/** Espaço guardado para a RESPOSTA — ela conta no mesmo teto do minuto. */
export const RESERVA_RESPOSTA_TOKENS = 2_600;
/** Piso: abaixo disto o histórico vira picado demais para valer análise. */
export const JANELA_MINIMA_CHARS = 8_000;

/**
 * Quantos caracteres de histórico cabem, dado quem vai atender.
 *
 * Usa o PRIMEIRO provedor configurado, que é o que a cascata tenta antes de
 * qualquer outro (ver llmTexto). Sem provedor nenhum, devolve a janela cheia —
 * não há chamada para dimensionar.
 */
export function janelaDeCaracteres(configurados: ProvedorId[], janelaCheia: number): number {
  const primeiro = configurados[0];
  if (!primeiro) return janelaCheia;

  const tetoTokens = TETO_ENTRADA[primeiro] - RESERVA_RESPOSTA_TOKENS;
  const tetoChars = tetoTokens * CHARS_POR_TOKEN - RESERVA_PROMPT_CHARS;

  if (tetoChars >= janelaCheia) return janelaCheia;
  return Math.max(JANELA_MINIMA_CHARS, tetoChars);
}

/**
 * A janela encolheu por causa do provedor? Serve para a tela explicar, em vez
 * de o vendedor achar que a IA "ficou burra" sem motivo.
 */
export function janelaApertada(configurados: ProvedorId[], janelaCheia: number): boolean {
  return janelaDeCaracteres(configurados, janelaCheia) < janelaCheia;
}

/**
 * O pedido cabe no provedor, ainda que com o histórico no mínimo?
 *
 * Esta é a pergunta honesta, e a resposta dela pode ser NÃO. O prompt de
 * instruções do Orientador tem 5.439 tokens; somado à resposta, já passa do
 * teto por minuto dos modelos gratuitos menores ANTES de entrar uma única
 * linha de conversa. Nesse caso não existe janela pequena o bastante: o
 * pedido é estruturalmente grande demais, e insistir só gera 429 atrás de 429.
 *
 * Quem chama usa isto para pular direto para o próximo provedor em vez de
 * queimar a cota numa tentativa que já se sabe perdida — e para a tela poder
 * dizer a verdade ao vendedor em vez de "tente de novo em 1 minuto".
 */
export function cabeNoProvedor(provedor: ProvedorId): boolean {
  const necessarioTokens =
    RESERVA_PROMPT_CHARS / CHARS_POR_TOKEN +
    RESERVA_RESPOSTA_TOKENS +
    JANELA_MINIMA_CHARS / CHARS_POR_TOKEN;
  return TETO_ENTRADA[provedor] >= necessarioTokens;
}
