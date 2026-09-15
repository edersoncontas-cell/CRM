import { describe, expect, it } from "vitest";
import { normalizarPlanoFiltro } from "../src/lib/filtro-contatos-plano";

const atual = { termos: ["contab", "hotel"], palavras: ["banco", "pme"] };

describe("normalizarPlanoFiltro", () => {
  it("normaliza valor (minúsculo, sem acento), força o tipo e tira repetidos", () => {
    const p = normalizarPlanoFiltro({
      resposta: "  Vou bloquear despachante e cartório. ",
      adicionar: [{ tipo: "palavra", valor: "Despachante" }, { tipo: "termo", valor: "Cartório" }, { tipo: "x", valor: "despachante" }, { tipo: "palavra", valor: " despachante " }],
      remover: [],
    }, atual);
    expect(p.resposta).toBe("Vou bloquear despachante e cartório.");
    expect(p.adicionar).toEqual([{ tipo: "palavra", valor: "despachante" }, { tipo: "termo", valor: "cartorio" }]);
  });

  it("não adiciona o que já está na lista e só remove o que existe (no tipo certo)", () => {
    const p = normalizarPlanoFiltro({
      adicionar: [{ tipo: "termo", valor: "hotel" }, { tipo: "palavra", valor: "banco" }],
      remover: [{ tipo: "termo", valor: "hotel" }, { tipo: "palavra", valor: "hotel" }, { tipo: "palavra", valor: "inexistente" }],
    }, atual);
    expect(p.adicionar).toEqual([]);
    expect(p.remover).toEqual([{ tipo: "termo", valor: "hotel" }]);
  });

  it("tolera JSON quebrado, valores vazios ou longos demais", () => {
    expect(normalizarPlanoFiltro(null, atual)).toEqual({ resposta: "", adicionar: [], remover: [] });
    const p = normalizarPlanoFiltro({ adicionar: [{ valor: "" }, { valor: 123 }, { valor: "a".repeat(41) }, "lixo"], remover: "não é lista" }, atual);
    expect(p.adicionar).toEqual([]);
    expect(p.remover).toEqual([]);
  });
});
