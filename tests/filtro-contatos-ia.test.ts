import { describe, expect, it } from "vitest";
import { normalizarPlanoFiltro } from "../src/lib/filtro-contatos-plano";

// Uma lista só, de palavras inteiras (01/10). Com acento gravado, como no card dele.
const atual = { palavras: ["banco", "pme", "hotel", "escritório"] };

describe("normalizarPlanoFiltro", () => {
  it("normaliza valor (minúsculo, sem acento), tira repetidos e ignora o 'tipo' antigo", () => {
    const p = normalizarPlanoFiltro({
      resposta: "  Vou bloquear despachante e cartório. ",
      adicionar: [{ tipo: "palavra", valor: "Despachante" }, { tipo: "termo", valor: "Cartório" }, { valor: "despachante" }, { valor: " despachante " }],
      remover: [],
    }, atual);
    expect(p.resposta).toBe("Vou bloquear despachante e cartório.");
    expect(p.adicionar).toEqual([{ valor: "despachante" }, { valor: "cartorio" }]);
  });

  it("não adiciona o que já está na lista e só remove o que existe", () => {
    const p = normalizarPlanoFiltro({
      adicionar: [{ valor: "hotel" }, { valor: "banco" }, { valor: "Escritorio" }],
      remover: [{ valor: "hotel" }, { valor: "inexistente" }],
    }, atual);
    expect(p.adicionar).toEqual([]);
    expect(p.remover).toEqual([{ valor: "hotel" }]);
  });

  it("remove pelo valor como está gravado: 'escritorio' tira 'escritório'", () => {
    const p = normalizarPlanoFiltro({ remover: [{ valor: "escritorio" }] }, atual);
    expect(p.remover).toEqual([{ valor: "escritório" }]);
  });

  it("palavra curta demais não entra (o filtro a ignoraria e ela ficaria parecendo que filtra)", () => {
    const p = normalizarPlanoFiltro({ adicionar: [{ valor: "da" }, { valor: "s/a" }, { valor: "ltda" }] }, atual);
    expect(p.adicionar).toEqual([{ valor: "ltda" }]);
  });

  it("tolera JSON quebrado, valores vazios ou longos demais", () => {
    expect(normalizarPlanoFiltro(null, atual)).toEqual({ resposta: "", adicionar: [], remover: [] });
    const p = normalizarPlanoFiltro({ adicionar: [{ valor: "" }, { valor: 123 }, { valor: "a".repeat(41) }, "lixo"], remover: "não é lista" }, atual);
    expect(p.adicionar).toEqual([]);
    expect(p.remover).toEqual([]);
  });
});
