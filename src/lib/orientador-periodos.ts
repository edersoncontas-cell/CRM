// Períodos do Orientador de Vendas / contador de "clientes conversados"
// (janelas móveis, contadas a partir de agora). Fica fora de actions.ts
// porque arquivos "use server" só podem exportar funções assíncronas.

export const PERIODOS_ORIENTADOR = {
  dia: { dias: 1, label: "Último dia", curto: "Dia" },
  semana: { dias: 7, label: "Última semana", curto: "Semana" },
  mes: { dias: 30, label: "Último mês", curto: "Mês" },
  "3m": { dias: 90, label: "Últimos 3 meses", curto: "3 meses" },
  "6m": { dias: 180, label: "Últimos 6 meses", curto: "6 meses" },
  ano: { dias: 365, label: "Último ano", curto: "Ano" },
} as const;

export type PeriodoOrientador = keyof typeof PERIODOS_ORIENTADOR;

export const PERIODO_PADRAO: PeriodoOrientador = "mes";

export function periodoValido(p: string | null | undefined): PeriodoOrientador {
  return p && p in PERIODOS_ORIENTADOR ? (p as PeriodoOrientador) : PERIODO_PADRAO;
}

export function corteDoPeriodo(p: PeriodoOrientador): Date {
  return new Date(Date.now() - PERIODOS_ORIENTADOR[p].dias * 86_400_000);
}
