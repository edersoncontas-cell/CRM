import { describe, expect, it } from "vitest";
import { mensagemTrivial, deveReanalisar } from "../src/lib/zeus/orientador-gatilho";

describe("mensagemTrivial", () => {
  it("figurinha, emoji, cortesia e 'sim/ok' são triviais", () => {
    for (const t of ["Sim", "ok", "Blz", "kkkk", "Bom dia!", "👍", "🙏🙏", "[sticker]", "Figurinha", "Obrigado!", "tá bom", ""]) {
      expect(mensagemTrivial(t), t).toBe(true);
    }
    expect(mensagemTrivial("", "image")).toBe(true);
  });
  it("conteúdo de negócio não é trivial", () => {
    for (const t of ["Quanto custa a B110C?", "Amanhã cedo te dou uma posição", "Tem financiamento?", "3", "e a retro?", "Vou financiar pelo BB"]) {
      expect(mensagemTrivial(t), t).toBe(false);
    }
  });
});

describe("deveReanalisar", () => {
  const agora = new Date("2026-09-15T20:00:00Z");
  const min = (n: number) => new Date(agora.getTime() - n * 60_000);

  it("sem análise anterior sempre analisa, mesmo com mensagem trivial", () => {
    expect(deveReanalisar({ ultimaAnaliseEm: null, novas: [{ texto: "oi" }], agora })).toEqual({ reanalisar: true, motivo: "sem_analise" });
  });
  it("só trivial depois de uma análise → não gasta IA", () => {
    expect(deveReanalisar({ ultimaAnaliseEm: min(120), novas: [{ texto: "Sim" }, { texto: "", mediaType: "image" }], agora }).reanalisar).toBe(false);
  });
  it("conteúdo novo analisa; rajada curta logo após a última análise espera", () => {
    expect(deveReanalisar({ ultimaAnaliseEm: min(120), novas: [{ texto: "Quanto fica a vista?" }], agora }).motivo).toBe("conteudo_novo");
    expect(deveReanalisar({ ultimaAnaliseEm: min(1), novas: [{ texto: "e a retro?" }], agora }).motivo).toBe("muito_recente");
    // mensagem longa logo depois passa mesmo assim
    expect(deveReanalisar({ ultimaAnaliseEm: min(1), novas: [{ texto: "Falei com meu sócio e a gente quer fechar a escavadeira E145 financiada pelo BB, entrada de 30%. Consegue proposta pra sexta?" }], agora }).reanalisar).toBe(true);
  });
});
