// MENSAGEM EM MASSA MARCADA PARA SAIR MAIS TARDE.
//
//   "deixa a opção de programar a postagem, com a data e a hora padrão
//    horário de brasilia."
//
// Regras puras: montar o instante a partir do dia e da hora que o vendedor
// escolheu, e dizer se dá para agendar. Sem banco, sem fuso escondido.
//
// Por que o fuso é explícito e fixo: o servidor roda em UTC e o vendedor vive
// em Brasília. "09:00" digitado por ele é 09:00 DELE — se o servidor
// interpretasse como UTC, a mensagem sairia às 6 da manhã, antes do cliente
// acordar. Brasília é UTC-3 o ano todo desde que o horário de verão acabou,
// em 2019; por isso o deslocamento é escrito, e não calculado.

export const FUSO_BRASILIA = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** Folga mínima: agendar para "daqui a um minuto" só geraria confusão. */
export const ANTECEDENCIA_MINIMA_MIN = 2;

/** O dia de hoje em Brasília, no formato YYYY-MM-DD (o que o seletor usa). */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO_BRASILIA });
}

/** A hora atual em Brasília, no formato HH:MM. */
export function horaEmBrasilia(agora: Date = new Date()): string {
  return agora.toLocaleTimeString("pt-BR", { timeZone: FUSO_BRASILIA, hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * O instante do envio, a partir do dia e da hora de Brasília.
 *
 * Devolve null quando o que veio não é uma data/hora válida — quem chama
 * trata, em vez de gravar um Invalid Date no banco e descobrir depois.
 */
export function instanteDoEnvio(diaISO: string, horaHM: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaISO)) return null;
  if (!/^\d{2}:\d{2}$/.test(horaHM)) return null;
  const d = new Date(`${diaISO}T${horaHM}:00.000${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ChecagemAgendamento = { ok: true; quando: Date } | { ok: false; erro: string };

/** Dá para agendar para este dia e hora? */
export function checarAgendamento(diaISO: string, horaHM: string, agora: Date = new Date()): ChecagemAgendamento {
  const quando = instanteDoEnvio(diaISO, horaHM);
  if (!quando) return { ok: false, erro: "Data ou horário inválido." };
  const minimo = agora.getTime() + ANTECEDENCIA_MINIMA_MIN * 60_000;
  if (quando.getTime() < minimo) {
    return { ok: false, erro: `Escolha um horário pelo menos ${ANTECEDENCIA_MINIMA_MIN} minutos à frente — para enviar agora, use “Enviar agora”.` };
  }
  // Um ano é teto de sanidade: erro de digitação no ano (2062 em vez de 2026)
  // sumiria com a mensagem para sempre, sem nada na tela explicando.
  if (quando.getTime() > agora.getTime() + 365 * 86_400_000) {
    return { ok: false, erro: "Mais de um ano à frente? Confira o ano da data." };
  }
  return { ok: true, quando };
}

/** "21/09/2026 às 09:00" — como o vendedor lê. */
export function quandoPorExtenso(d: Date): string {
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO_BRASILIA, day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO_BRASILIA, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia} às ${hora}`;
}

/**
 * Já passou da hora de enviar?
 *
 * O despachante roda de tempos em tempos, então o envio sai NA PRIMEIRA
 * passada depois do horário — nunca antes, e não exatamente no minuto.
 */
export function estaNaHora(quando: Date, agora: Date = new Date()): boolean {
  return quando.getTime() <= agora.getTime();
}

// ── O ENVIO GRANDE SAI EM ONDAS ───────────────────────────────────────────
//
// "aumente para 2 mil"
//
// O teto de clientes por envio e a regra de como uma rodada do despachante
// fecha. Moram aqui, e não no despacho, porque são a parte que dá para provar
// sem banco — e porque o "use server" das actions não pode exportar constante.

/**
 * Teto de clientes por envio programado.
 *
 * Não é o quanto sai de uma vez: é o tamanho da lista que ele pode marcar. O
 * despachante manda em ondas de 15 em 15 minutos até terminar (ver
 * fecharRodada), então 2 mil é uma lista de 2 mil, não um disparo de 2 mil.
 */
export const MAX_CLIENTES_POR_ENVIO = 2000;

/** Quantos vão por vez, e a pausa entre os lotes — o WhatsApp não gosta de rajada. */
export const TAMANHO_LOTE = 5;
export const PAUSA_ENTRE_LOTES_MS = 700;

/**
 * Prazo de UMA rodada. A função da Vercel morre em 60s; parar em 45 deixa
 * folga para gravar onde a rodada parou — que é o que permite continuar.
 */
export const PRAZO_RODADA_MS = 45_000;

/**
 * Teto otimista de quantos clientes cabem numa rodada: só a pausa entre os
 * lotes, sem contar o tempo de cada mensagem sair. O número real é bem menor.
 *
 * Existe para a tela poder dizer, por alto, em quantas ondas a lista sai —
 * e para o teste travar a conta que antes ninguém tinha feito: com 500 na
 * lista, o envio já estourava o prazo e o resto NUNCA saía.
 */
export function cabemPorRodada(prazoMs: number = PRAZO_RODADA_MS): number {
  return Math.max(TAMANHO_LOTE, Math.floor(prazoMs / PAUSA_ENTRE_LOTES_MS) * TAMANHO_LOTE);
}

/** Por alto, quantas rodadas de 15 minutos uma lista deste tamanho vai levar. */
export function ondasEstimadas(total: number): number {
  return Math.max(1, Math.ceil(total / cabemPorRodada()));
}

export type FechamentoRodada = { status: "enviado" | "pendente" | "erro"; concluido: boolean; erro: string | null };

/**
 * Como a rodada fecha: terminou, continua na próxima, ou morreu.
 *
 * Esta função é a correção de um buraco sério. Antes, quando o prazo acabava
 * no meio da lista, o envio era fechado como "enviado" com o resto nunca
 * mandado — a tela dizia que a mensagem tinha saído para os 1298, e mais de
 * mil pessoas não recebiam nada. Agora, lista pela metade volta para
 * "pendente" com o cursor gravado, e a rodada seguinte continua de onde parou.
 *
 * "erro" fica reservado para o envio que não conseguiu mandar NADA, em
 * nenhuma rodada: aí não é uma onda que faltou, é um envio que não anda.
 */
export function fecharRodada(
  cursor: number,
  total: number,
  enviados: number,
  erroFatal: string | null,
): FechamentoRodada {
  if (cursor >= total) {
    return { status: "enviado", concluido: true, erro: erroFatal };
  }
  if (erroFatal && enviados === 0) {
    return { status: "erro", concluido: true, erro: erroFatal };
  }
  return {
    status: "pendente",
    concluido: false,
    erro: erroFatal ?? `Saiu para ${cursor} de ${total}. O resto sai na próxima rodada.`,
  };
}
