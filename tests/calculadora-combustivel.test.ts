import { describe, expect, it } from "vitest";
import { calcularCombustivel, calcCombustivelPadrao } from "@/lib/calculadora-combustivel";

describe("calculadora de combustível", () => {
  it("exemplo do Edy: 12 L/h × 10 L/h, R$ 6, 150 h/mês, 5 anos", () => {
    const r = calcularCombustivel({ ...calcCombustivelPadrao(), concorrente: { nome: "PC130", valor: 590000, consumoLh: 12 }, newHolland: { nome: "E145C", valor: 650000, consumoLh: 10 } });
    expect(r.difLh).toBe(2);
    expect(r.litrosMes).toBe(300);
    expect(r.mes).toBe(1800);
    expect(r.ano).toBe(21600);
    expect(r.horizonte).toBe(108000);
    expect(r.diferencaPreco).toBe(60000);
    expect(r.liquido).toBe(48000);
    expect(r.paybackMeses).toBe(34);
  });

  it("New Holland mais barata: diferença de preço soma a favor", () => {
    const r = calcularCombustivel({ ...calcCombustivelPadrao(), concorrente: { nome: "", valor: 700000, consumoLh: 12 }, newHolland: { nome: "", valor: 650000, consumoLh: 10 } });
    expect(r.diferencaPreco).toBe(-50000);
    expect(r.liquido).toBe(158000);
    expect(r.paybackMeses).toBe(0);
  });

  it("consumo maior na New Holland dá economia negativa", () => {
    const r = calcularCombustivel({ ...calcCombustivelPadrao(), concorrente: { nome: "", valor: 0, consumoLh: 9 }, newHolland: { nome: "", valor: 0, consumoLh: 10 } });
    expect(r.difLh).toBe(-1);
    expect(r.mes).toBeLessThan(0);
  });
});
