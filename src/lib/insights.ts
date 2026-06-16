// Inteligência de pipeline: Lead Score A/B/C, alerta de "esfriando",
// previsão (forecast) e comissão estimada.

import { diasDesde } from "./utils";

export interface NegLite {
  valor: number | null;
  termometro: number;
  estagio: string;
  ultimoContato: Date | null;
  status: string;
}

// Probabilidade de fechamento por estágio (para o forecast).
export const PROB_ESTAGIO: Record<string, number> = {
  novo: 0.1,
  contato: 0.25,
  proposta: 0.5,
  negociacao: 0.7,
  fechamento: 0.9,
};

export function classificarLead(n: NegLite): { classe: "A" | "B" | "C"; esfriando: boolean } {
  const dias = diasDesde(n.ultimoContato);
  let pontos = 0;
  pontos += n.termometro; // 0-100
  if ((n.valor ?? 0) >= 1_000_000) pontos += 30;
  else if ((n.valor ?? 0) >= 400_000) pontos += 15;
  pontos += (PROB_ESTAGIO[n.estagio] ?? 0) * 40;
  if (dias <= 3) pontos += 15;
  else if (dias >= 14) pontos -= 20;

  const classe = pontos >= 110 ? "A" : pontos >= 70 ? "B" : "C";
  // "Esfriando": estava quente mas parou de responder
  const esfriando = n.status === "aberta" && n.termometro >= 60 && dias >= 7;
  return { classe, esfriando };
}

export function forecastValor(negs: NegLite[]): number {
  return negs
    .filter((n) => n.status === "aberta")
    .reduce((s, n) => s + (n.valor ?? 0) * (PROB_ESTAGIO[n.estagio] ?? 0), 0);
}

// Comissão estimada (% padrão configurável).
export function comissaoEstimada(valor: number, pct = 2): number {
  return valor * (pct / 100);
}

export const COR_CLASSE: Record<string, "green" | "yellow" | "slate"> = {
  A: "green",
  B: "yellow",
  C: "slate",
};
