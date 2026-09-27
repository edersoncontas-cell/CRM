import { describe, it, expect } from "vitest";
import { posVendaVoltou, calcularMarcoPendente } from "@/lib/pos-venda-marcos";

// "Resolvido" no pós-venda era definitivo (de propósito: a chave antiga fazia
// o card voltar sozinho). O efeito colateral: o cliente não voltava quando
// vencia o marco seguinte. Agora volta — por data, não por chave.

const compra = "2026-06-01T12:00:00Z";
const dia = (n: number) => new Date(new Date(compra).getTime() + n * 86_400_000);

describe("pós-venda resolvido volta no marco seguinte", () => {
  it("resolveu no dia 35 (marco de 30 dias): continua escondido enquanto o pendente é o de 30", () => {
    expect(posVendaVoltou({ dataCompra: compra, marcoPendente: { tipo: "marco_30d" } }, dia(35))).toBe(false);
  });
  it("vence o de 60 dias depois do clique: volta", () => {
    expect(posVendaVoltou({ dataCompra: compra, marcoPendente: { tipo: "marco_60d" } }, dia(35))).toBe(true);
  });
  it("resolveu já com o de 60 vencido: não volta por ele; volta no de 6 meses", () => {
    expect(posVendaVoltou({ dataCompra: compra, marcoPendente: { tipo: "marco_60d" } }, dia(70))).toBe(false);
    expect(posVendaVoltou({ dataCompra: compra, marcoPendente: { tipo: "marco_180d" } }, dia(70))).toBe(true);
  });
  it("sem marco pendente, sem data de compra ou sem data do clique: fica como está", () => {
    expect(posVendaVoltou({ dataCompra: compra, marcoPendente: null }, dia(35))).toBe(false);
    expect(posVendaVoltou({ dataCompra: null, marcoPendente: { tipo: "marco_60d" } }, dia(35))).toBe(false);
    expect(posVendaVoltou({ dataCompra: compra, marcoPendente: { tipo: "marco_60d" } }, null)).toBe(false);
  });
  it("a regra do marco pendente continua a mesma", () => {
    expect(calcularMarcoPendente(35, new Set())).toEqual({ tipo: "marco_30d", label: "30 dias" });
    expect(calcularMarcoPendente(65, new Set(["marco_30d"]))).toEqual({ tipo: "marco_60d", label: "60 dias" });
    expect(calcularMarcoPendente(20, new Set())).toBeNull();
  });
});
