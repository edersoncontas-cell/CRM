// Dia civil e meia-noite de Brasília (UTC−3 o ano todo). Módulo PURO: usado
// pelas regras de relatório e de metas. O servidor roda em UTC, o vendedor em
// Brasília — um período que "começa à meia-noite" tem que ser a dele.

export const DIA_MS = 24 * 60 * 60 * 1000;
const BRT_MS = 3 * 60 * 60 * 1000;

/** Ano / mês (0-11) / dia do calendário de Brasília para um instante. */
export function diaBR(d: Date): { a: number; m: number; d: number } {
  const x = new Date(d.getTime() - BRT_MS);
  return { a: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() };
}

/** 00:00 de Brasília do dia civil dado, como instante UTC. Mês/dia fora da faixa
 *  são normalizados (mês 12 vira janeiro do ano seguinte). */
export function meiaNoiteBR(a: number, m: number, d: number): Date {
  return new Date(Date.UTC(a, m, d) + BRT_MS);
}

export const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function fmtDiaBR(d: Date): string {
  const x = diaBR(d);
  return `${String(x.d).padStart(2, "0")}/${String(x.m + 1).padStart(2, "0")}/${x.a}`;
}
