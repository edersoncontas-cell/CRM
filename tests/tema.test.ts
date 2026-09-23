import { describe, it, expect } from "vitest";
import { modoValido, outroModo, corDaBarra, TEMA_PADRAO } from "@/lib/tema";

describe("modo do tema", () => {
  it("o padrão é o escuro — é o CRM que ele já usa", () => {
    expect(TEMA_PADRAO).toBe("escuro");
    expect(modoValido(undefined)).toBe("escuro");
    expect(modoValido(null)).toBe("escuro");
    expect(modoValido("")).toBe("escuro");
  });

  it("cookie adulterado ou antigo não quebra a tela, cai no padrão", () => {
    expect(modoValido("qualquer-coisa")).toBe("escuro");
    expect(modoValido("CLARO")).toBe("escuro"); // sensível a caixa de propósito
    expect(modoValido("dark")).toBe("escuro");
  });

  it("só 'claro' liga o tema claro", () => {
    expect(modoValido("claro")).toBe("claro");
  });

  it("alterna nos dois sentidos", () => {
    expect(outroModo("claro")).toBe("escuro");
    expect(outroModo("escuro")).toBe("claro");
  });

  it("a barra de status acompanha o tema", () => {
    expect(corDaBarra("escuro")).toBe("#09090b");
    expect(corDaBarra("claro")).not.toBe("#09090b");
    expect(corDaBarra("claro")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
