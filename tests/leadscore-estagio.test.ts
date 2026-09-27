import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { calcularLeadScore, type FatoresLeadScore } from "@/lib/zeus/leadscore";
import { criarProbabilidadePorEstagio, valorPonderado, FUNIL_CANONICO } from "@/lib/pipeline";

// O defeito: a pontuação do lead lia a probabilidade da fase por um mapa com
// os nomes ANTIGOS do funil ("primeiro_contato", "proposta_bcnh"…). As
// negociações de hoje guardam o título da coluna ("PROPOSTA", "NEGOCIAÇÃO"),
// então a fase contava zero para todo mundo: um cliente em NEGOCIAÇÃO
// pontuava igual a um em OPORTUNIDADE.

const colunas = FUNIL_CANONICO.map((c) => ({ titulo: c.titulo, papel: c.papel, probabilidade: c.probabilidade }));
const probDe = criarProbabilidadePorEstagio(colunas);
const base: FatoresLeadScore = {
  termometro: 60, valor: 300_000, estagio: null, diasSemContato: 3,
  temVisitaAgendada: false, concorrenteMencionado: false, aguardandoResposta: false,
  temNegociacaoAberta: true, interesseFuturo: false,
};
const score = (estagio: string) => calcularLeadScore({ ...base, estagio, probEstagio: probDe(estagio) });

describe("lead score pela fase do funil de hoje", () => {
  it("a probabilidade vem da coluna, pelo título gravado na negociação", () => {
    expect(probDe("OPORTUNIDADE")).toBe(0.2);
    expect(probDe("PROPOSTA")).toBe(0.5);
    expect(probDe("NEGOCIAÇÃO")).toBe(0.8);
    expect(probDe("coluna que não existe")).toBeNull();
  });
  it("NEGOCIAÇÃO pontua mais que PROPOSTA, que pontua mais que OPORTUNIDADE", () => {
    expect(score("NEGOCIAÇÃO")).toBeGreaterThan(score("PROPOSTA"));
    expect(score("PROPOSTA")).toBeGreaterThan(score("OPORTUNIDADE"));
  });
  it("a probabilidade ajustada pelo vendedor na coluna vale", () => {
    const ajustada = criarProbabilidadePorEstagio([{ titulo: "PROPOSTA", papel: "banco", probabilidade: 90 }]);
    expect(ajustada("PROPOSTA")).toBe(0.9);
  });
  it("negociação antiga, com o nome velho da fase, continua pontuando pelo mapa antigo", () => {
    const velho = calcularLeadScore({ ...base, estagio: "proposta_bcnh", probEstagio: probDe("proposta_bcnh") });
    const semFase = calcularLeadScore({ ...base, estagio: "inexistente", probEstagio: null });
    expect(velho).toBeGreaterThan(semFase);
  });
  it("a previsão ponderada do funil continua igual (mesma consulta)", () => {
    const negs = [
      { estagio: "PROPOSTA", status: "aberta", valor: 100_000 },
      { estagio: "NEGOCIAÇÃO", status: "aberta", valor: 200_000 },
      { estagio: "FATURADO", status: "ganha", valor: 999_999 },
    ];
    expect(valorPonderado(negs, colunas)).toBe(50_000 + 160_000);
  });
});
