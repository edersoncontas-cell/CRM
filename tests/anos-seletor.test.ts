// "Em negociações olha o 20 ainda lá, remova isso logo."
//
// O seletor de ano era montado com os anos que APARECEM nas datas do banco,
// sem perguntar se aquilo era um ano possível. Bastou um registro com data
// digitada errada — "20/09/20" virando o ano 20 — para o CRM passar a
// oferecer "20" como filtro, ao lado de 2026 e 2025.

import { describe, it, expect } from "vitest";
import { anosParaSeletor, anoPlausivel, ANO_MINIMO } from "@/lib/anos-seletor";

const ANO = 2026;
const d = (iso: string) => new Date(iso);

describe("o que é um ano possível neste CRM", () => {
  it("o ano 20 não é — era exatamente o que aparecia na tela", () => {
    expect(anoPlausivel(20, ANO)).toBe(false);
  });

  it("ano atual, passados recentes e o ano que vem são", () => {
    // O ano que vem entra por causa de faturamento programado.
    expect(anoPlausivel(ANO, ANO)).toBe(true);
    expect(anoPlausivel(ANO - 1, ANO)).toBe(true);
    expect(anoPlausivel(ANO + 1, ANO)).toBe(true);
    expect(anoPlausivel(ANO_MINIMO, ANO)).toBe(true);
  });

  it("futuro distante e ano anterior ao mínimo não são", () => {
    expect(anoPlausivel(ANO + 2, ANO)).toBe(false);
    expect(anoPlausivel(1999, ANO)).toBe(false);
    expect(anoPlausivel(0, ANO)).toBe(false);
    expect(anoPlausivel(-20, ANO)).toBe(false);
  });

  it("número quebrado não passa", () => {
    expect(anoPlausivel(2026.5, ANO)).toBe(false);
    expect(anoPlausivel(NaN, ANO)).toBe(false);
  });
});

describe("os anos que o seletor oferece", () => {
  it("a data quebrada some da lista, o resto fica", () => {
    const anos = anosParaSeletor(ANO, [d("2026-03-01"), d("2025-07-10"), d("0020-09-20")]);
    expect(anos).toEqual([2026, 2025]);
    expect(anos).not.toContain(20);
  });

  it("do mais novo para o mais velho", () => {
    expect(anosParaSeletor(ANO, [d("2024-01-01"), d("2026-01-01"), d("2025-01-01")])).toEqual([2026, 2025, 2024]);
  });

  it("sem repetir ano", () => {
    expect(anosParaSeletor(ANO, [d("2025-01-01"), d("2025-06-01"), d("2025-12-31")])).toEqual([2026, 2025]);
  });

  it("o ano atual entra mesmo sem lançamento nenhum", () => {
    // Senão a tela abriria sem nenhuma opção de filtro.
    expect(anosParaSeletor(ANO, [])).toEqual([ANO]);
  });

  it("datas nulas não derrubam a lista", () => {
    expect(anosParaSeletor(ANO, [null, undefined, d("2025-05-05")])).toEqual([2026, 2025]);
  });
});
