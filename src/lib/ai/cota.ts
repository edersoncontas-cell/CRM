// "E essa cota aí? É verdade?"
//
// É verdade que o provedor recusou — mas o CRM estava contando a história
// errada, e de um jeito que custa dia de trabalho.
//
// Os provedores gratuitos têm DOIS limites bem diferentes:
//
//   • TPM / RPM — tokens (ou pedidos) POR MINUTO. Estoura numa rajada de
//     análises e LIBERA SOZINHO EM SEGUNDOS. O Groq inclusive diz quanto:
//     "Please try again in 8.5s."
//   • TPD / RPD — tokens POR DIA. Esse sim só volta na virada do dia.
//
// O CRM tratava os dois como o mesmo: marcava o modelo como esgotado por UMA
// HORA e mostrava "a cota de IA de hoje acabou". Num limite por minuto, isso
// é falso duas vezes — a cota volta em 9 segundos, e o vendedor, lendo que
// acabou por hoje, para de tentar. Passou o dia sem Orientador por causa de
// uma rajada de 9 segundos.
//
// Aqui fica a leitura do 429: que tipo de limite é, e quanto esperar de
// verdade. Módulo puro (sem rede, sem banco), com teste.

export type TipoLimite = "minuto" | "dia" | "desconhecido";

/** Espera padrão quando o provedor não diz quanto. Curta de propósito. */
export const ESPERA_PADRAO_MINUTO_MS = 60_000;
/** Limite diário sem hora informada: uma hora, e tenta de novo. */
export const ESPERA_PADRAO_DIA_MS = 60 * 60_000;

/**
 * Que limite estourou.
 *
 * "por dia" ganha de "por minuto" quando os dois aparecem: o diário é o mais
 * restritivo, e errar para o lado de esperar mais é mais seguro do que
 * martelar um limite diário.
 */
export function tipoDeLimite(detalhe: string): TipoLimite {
  const t = (detalhe ?? "").toLowerCase();
  if (/\btpd\b|\brpd\b|per\s*day|por\s*dia|daily|requests?\s*per\s*day/.test(t)) return "dia";
  if (/\btpm\b|\brpm\b|per\s*minute|por\s*minuto|requests?\s*per\s*minute/.test(t)) return "minuto";
  return "desconhecido";
}

/**
 * Quanto esperar, em milissegundos, segundo o PRÓPRIO provedor.
 *
 * Dois formatos, os dois reais:
 *   Groq:   "Please try again in 8.5s." / "try again in 4h32m17s"
 *   Gemini: {"retryDelay":"37s"}
 *
 * Devolve null quando o provedor não disse — aí quem chama usa o padrão do
 * tipo de limite.
 */
export function esperaInformada(detalhe: string): number | null {
  const t = detalhe ?? "";

  const retry = /"?retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i.exec(t);
  if (retry) return Math.round(parseFloat(retry[1]) * 1000);

  const tente = /try again in\s+([0-9hms.\s]+)/i.exec(t);
  if (tente) {
    const trecho = tente[1];
    const h = /(\d+(?:\.\d+)?)\s*h/i.exec(trecho);
    const m = /(\d+(?:\.\d+)?)\s*m(?!s)/i.exec(trecho);
    const s = /(\d+(?:\.\d+)?)\s*s/i.exec(trecho);
    const ms =
      (h ? parseFloat(h[1]) * 3_600_000 : 0) +
      (m ? parseFloat(m[1]) * 60_000 : 0) +
      (s ? parseFloat(s[1]) * 1000 : 0);
    if (ms > 0) return Math.round(ms);
  }
  return null;
}

/**
 * Por quanto tempo este modelo deve ficar fora do rodízio.
 *
 * Prioridade: o que o provedor informou > o padrão do tipo de limite. Com teto
 * de 6 horas, para um "try again in 23h" não congelar o modelo até amanhã
 * quando na prática a cota costuma voltar antes.
 */
export function esperaDoLimite(detalhe: string): number {
  const informada = esperaInformada(detalhe);
  if (informada != null && informada > 0) return Math.min(informada, 6 * 60 * 60_000);
  return tipoDeLimite(detalhe) === "dia" ? ESPERA_PADRAO_DIA_MS : ESPERA_PADRAO_MINUTO_MS;
}

/** "8 segundos", "3 minutos", "2 horas" — para caber numa frase. */
export function emPortugues(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} segundo${s === 1 ? "" : "s"}`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} minuto${min === 1 ? "" : "s"}`;
  const h = Math.round(min / 60);
  return `${h} hora${h === 1 ? "" : "s"}`;
}

/**
 * A frase que o vendedor lê. Diz a verdade sobre o tempo, que é a única coisa
 * que muda o que ele faz agora: esperar um minuto ou tocar o dia sem o painel.
 */
export function mensagemDeCota(detalhe: string): string {
  const tipo = tipoDeLimite(detalhe);
  const espera = esperaDoLimite(detalhe);

  if (tipo === "dia") {
    return "A cota diária de IA acabou. A leitura abaixo é a última e continua valendo; ela se atualiza sozinha quando a cota virar.";
  }
  // Por minuto (ou não informado, que na prática quase sempre é por minuto):
  // o número é o que importa — sem ele o vendedor desiste do dia à toa.
  return `A IA atingiu o limite por minuto — volta em ${emPortugues(espera)}. A leitura abaixo é a última e continua valendo; toque em Reanalisar daqui a pouco.`;
}
