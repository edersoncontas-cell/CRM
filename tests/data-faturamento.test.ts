// O seletor de ano do Dashboard mostrava um "20" ao lado de 2026 e 2025.
// Era uma venda gravada com o ano 20 — e, pior que o chip feio, aquela venda
// não caía em ano nenhum: sumia do faturamento, da contagem, da meta e do
// ticket médio.

import { describe, it, expect } from "vitest";
import { anoPlausivel, anosParaSeletor, lerDataFaturamento, LIMITE_DATA_FATURAMENTO } from "@/lib/data-faturamento";

const anoAtual = new Date().getFullYear();

describe("ano plausível", () => {
  it("aceita os anos de verdade", () => {
    expect(anoPlausivel(anoAtual)).toBe(true);
    expect(anoPlausivel(anoAtual - 1)).toBe(true);
    expect(anoPlausivel(2025)).toBe(true);
  });

  it("recusa o absurdo — é daqui que vinha o 20", () => {
    expect(anoPlausivel(20)).toBe(false);
    expect(anoPlausivel(205)).toBe(false);
    expect(anoPlausivel(1900)).toBe(false);
    expect(anoPlausivel(3000)).toBe(false);
  });

  it("cobre tudo que o seletor de roda deixa escolher (anoAtual-10 a +4)", () => {
    // Senão o servidor recusaria uma data que a própria tela ofereceu.
    for (let a = anoAtual - 10; a <= anoAtual + 4; a++) {
      expect(anoPlausivel(a), `ano ${a} devia ser aceito`).toBe(true);
    }
  });
});

describe("seletor de anos do Dashboard", () => {
  it("o 20 não vira chip", () => {
    expect(anosParaSeletor([2026, 2025, 20])).toEqual([2026, 2025]);
  });

  it("mantém a ordem do mais novo para o mais velho e sem repetir", () => {
    expect(anosParaSeletor([2025, 2026, 2025, 2024])).toEqual([2026, 2025, 2024]);
  });

  it("lista vazia não quebra", () => {
    expect(anosParaSeletor([])).toEqual([]);
    expect(anosParaSeletor([20, 3])).toEqual([]);
  });
});

describe("gravação da data de faturamento", () => {
  it("data boa passa, no meio-dia de Brasília (não anda de dia)", () => {
    const r = lerDataFaturamento("2026-09-15");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.getFullYear()).toBe(2026);
      expect(r.data.toISOString()).toBe("2026-09-15T15:00:00.000Z"); // 12h em -03:00
    }
  });

  it("ano absurdo é recusado com motivo em português", () => {
    const r = lerDataFaturamento("0020-09-15");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toContain("20");
      expect(r.erro).not.toContain("Invalid");
    }
  });

  it("vazio e formato errado são recusados", () => {
    expect(lerDataFaturamento("").ok).toBe(false);
    expect(lerDataFaturamento("15/09/2026").ok).toBe(false);
    expect(lerDataFaturamento("2026-9-5").ok).toBe(false);
  });

  it("dia que não existe é recusado", () => {
    expect(lerDataFaturamento("2026-02-31").ok).toBe(false);
  });

  it("os limites do campo batem com a regra do servidor", () => {
    expect(anoPlausivel(Number(LIMITE_DATA_FATURAMENTO.min.slice(0, 4)))).toBe(true);
    expect(anoPlausivel(Number(LIMITE_DATA_FATURAMENTO.max.slice(0, 4)))).toBe(true);
  });
});
