// Os anos que o seletor pode oferecer.
//
//   "Em negociações olha o 20 ainda lá, remova isso logo."
//
// O seletor era montado com os anos que APARECEM nas datas do banco, sem
// perguntar se aquilo era um ano possível. Bastava um registro com data
// digitada errada — "20/09/20" virando o ano 20 — para o CRM passar a
// oferecer "20" como filtro, ao lado de 2026 e 2025.
//
// O ano de um lançamento do CRM está entre 2000 e o ano que vem (faturamento
// programado). Fora disso não é ano: é data quebrada, e data quebrada não
// vira opção de filtro.

export const ANO_MINIMO = 2000;

/** Um ano plausível para um lançamento deste CRM? */
export function anoPlausivel(ano: number, anoAtual: number): boolean {
  return Number.isInteger(ano) && ano >= ANO_MINIMO && ano <= anoAtual + 1;
}

/**
 * Anos do seletor: o ano atual sempre entra (mesmo sem lançamento nenhum,
 * senão a tela abriria sem opção alguma), mais os anos plausíveis encontrados
 * nas datas, do mais novo para o mais velho.
 */
export function anosParaSeletor(anoAtual: number, datas: (Date | null | undefined)[]): number[] {
  const anos = new Set<number>([anoAtual]);
  for (const d of datas) {
    if (!d) continue;
    const ano = d.getFullYear();
    if (anoPlausivel(ano, anoAtual)) anos.add(ano);
  }
  return Array.from(anos).sort((a, b) => b - a);
}
