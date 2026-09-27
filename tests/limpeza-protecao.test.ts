import { describe, it, expect } from "vitest";
import { podeApagarNaLimpeza, decisaoDoVendedor } from "@/lib/limpeza-protecao";
import { MOTIVO_ASTERISCO, MOTIVO_EXCLUIDO_MANUAL } from "@/lib/utils";

// A limpeza automática apagava pelo NOME, com cascata: um termo largo na
// lista ("central") levava a "Terraplenagem Central" com a venda em
// andamento. A prova com banco de verdade está descrita no commit; aqui, a regra.

describe("a limpeza automática nunca apaga quem tem vida comercial", () => {
  it("sem histórico: sai, como sempre", () => {
    expect(podeApagarNaLimpeza({ temHistorico: false, motivo: "central" })).toBe(true);
  });
  it("com negociação/visita/compra, termo da lista NÃO basta", () => {
    expect(podeApagarNaLimpeza({ temHistorico: true, motivo: "central" })).toBe(false);
    expect(podeApagarNaLimpeza({ temHistorico: true, motivo: "contab" })).toBe(false);
    expect(podeApagarNaLimpeza({ temHistorico: true, motivo: null })).toBe(false);
  });
  it("com histórico, sai só por decisão dele (asterisco ou 'excluir' na lista)", () => {
    expect(podeApagarNaLimpeza({ temHistorico: true, motivo: MOTIVO_ASTERISCO })).toBe(true);
    expect(podeApagarNaLimpeza({ temHistorico: true, motivo: MOTIVO_EXCLUIDO_MANUAL })).toBe(true);
    expect(decisaoDoVendedor("central")).toBe(false);
  });
});
