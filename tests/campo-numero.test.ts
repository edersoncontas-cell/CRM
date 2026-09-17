import { describe, it, expect } from "vitest";
import { paraTexto, paraNumero, sanitizarDigitado } from "../src/lib/campo-numero-regra";

describe("CampoNumero: texto ↔ número", () => {
  it("0 vira campo vazio — é assim que o valor anterior 'some'", () => {
    expect(paraTexto(0)).toBe("");
    expect(paraTexto(-0)).toBe("");
  });

  it("número normal vira texto com vírgula decimal", () => {
    expect(paraTexto(10)).toBe("10");
    expect(paraTexto(12.5)).toBe("12,5");
    expect(paraTexto(600000)).toBe("600000");
  });

  it("texto vazio ou só espaço volta a ser 0", () => {
    expect(paraNumero("")).toBe(0);
    expect(paraNumero("   ")).toBe(0);
  });

  it("aceita vírgula ou ponto como separador decimal", () => {
    expect(paraNumero("12,5")).toBe(12.5);
    expect(paraNumero("12.5")).toBe(12.5);
    expect(paraNumero("10")).toBe(10);
  });

  it("texto inválido vira 0 em vez de NaN", () => {
    expect(paraNumero("abc")).toBe(0);
    expect(paraNumero(",")).toBe(0);
  });
});

describe("sanitizarDigitado: o que sobrevive de cada tecla", () => {
  it("campo decimal: só dígitos e um separador, sempre vira vírgula", () => {
    expect(sanitizarDigitado("10", false)).toBe("10");
    expect(sanitizarDigitado("12.5", false)).toBe("12,5");
    expect(sanitizarDigitado("12,5", false)).toBe("12,5");
    expect(sanitizarDigitado("abc123", false)).toBe("123");
  });

  it("segunda vírgula/ponto digitado é ignorado (não vira '12,,5' nem '12,5,3')", () => {
    expect(sanitizarDigitado("12,5,3", false)).toBe("12,53");
    expect(sanitizarDigitado("12,,5", false)).toBe("12,5");
    expect(sanitizarDigitado("1.2.3", false)).toBe("1,23");
  });

  it("campo inteiro (parcelas, dias, meses…): nunca aceita separador", () => {
    expect(sanitizarDigitado("12", true)).toBe("12");
    expect(sanitizarDigitado("12,5", true)).toBe("125");
    expect(sanitizarDigitado("1.2", true)).toBe("12");
  });

  it("apagar tudo (backspace até o fim) deixa vazio, nada fica preso", () => {
    expect(sanitizarDigitado("", false)).toBe("");
    expect(sanitizarDigitado("", true)).toBe("");
  });
});
