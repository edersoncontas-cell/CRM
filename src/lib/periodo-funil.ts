// PERÍODO DO FUNIL: ano e mês.
//
// "No novo funil faça separação por período, mês e ano."
//
// Módulo puro (sem banco) para dar para provar a conta — e a conta aqui tem
// uma armadilha de fuso. O servidor roda em UTC e o vendedor vive em Brasília:
// uma máquina faturada às 21h de 30/09 é 00h de 01/10 em UTC. Montando o
// intervalo em UTC, essa venda cairia em OUTUBRO no relatório de setembro, e
// ninguém desconfiaria — o erro só aparece nas últimas 3 horas de cada mês.
// Por isso o deslocamento de Brasília é escrito, não calculado: -03:00 o ano
// todo desde que o horário de verão acabou, em 2019.

const OFFSET_BRASILIA = "-03:00";

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

export type Periodo = { ano: number | "todos"; mes: number | null };

/** Mês vindo da URL: 1..12, ou null (ano inteiro). Lixo vira null, nunca erro. */
export function mesDaUrl(bruto: string | undefined | null): number | null {
  const n = Number(bruto);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

/**
 * O intervalo [gte, lt) do período, em instantes reais.
 *
 * null = sem recorte (todos os anos). Mês sem ano também é null: filtrar
 * "setembro" sem dizer de que ano juntaria setembros de anos diferentes na
 * mesma conta, que é pior do que não filtrar.
 */
export function intervaloDoPeriodo(p: Periodo): { gte: Date; lt: Date } | null {
  if (p.ano === "todos") return null;
  const dois = (n: number) => String(n).padStart(2, "0");
  if (p.mes == null) {
    return {
      gte: new Date(`${p.ano}-01-01T00:00:00${OFFSET_BRASILIA}`),
      lt: new Date(`${p.ano + 1}-01-01T00:00:00${OFFSET_BRASILIA}`),
    };
  }
  const viraAno = p.mes === 12;
  return {
    gte: new Date(`${p.ano}-${dois(p.mes)}-01T00:00:00${OFFSET_BRASILIA}`),
    lt: new Date(`${viraAno ? p.ano + 1 : p.ano}-${dois(viraAno ? 1 : p.mes + 1)}-01T00:00:00${OFFSET_BRASILIA}`),
  };
}

/** Como o vendedor lê o período: "setembro de 2026", "2026", "todo o histórico". */
export function rotuloPeriodo(p: Periodo): string {
  if (p.ano === "todos") return "todo o histórico";
  if (p.mes == null) return String(p.ano);
  return `${MESES[p.mes - 1]} de ${p.ano}`;
}

/** A query string do período, para os links manterem o recorte escolhido. */
export function queryDoPeriodo(p: Periodo, extra?: Record<string, string | null>): string {
  const q = new URLSearchParams();
  if (p.ano === "todos") q.set("ano", "todos");
  else q.set("ano", String(p.ano));
  if (p.mes != null) q.set("mes", String(p.mes));
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v == null) q.delete(k);
    else q.set(k, v);
  }
  return q.toString();
}
