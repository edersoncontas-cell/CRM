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
