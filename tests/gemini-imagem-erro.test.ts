// Ao gerar a arte, a tela mostrava o JSON cru da Google ("You exceeded your
// current quota…"), que não diz ao vendedor o que fazer. Estes testes travam
// a tradução para português.

import { describe, it, expect } from "vitest";
import { mensagemDoErro } from "@/lib/ai/imagem";

describe("erro do Gemini traduzido", () => {
  it("cota do dia acabou: diz que volta amanhã e que o texto continua", () => {
    const m = mensagemDoErro(429, '{"error":{"code":429,"message":"Quota exceeded for quota metric per day"}}');
    expect(m).toContain("acabou por hoje");
    expect(m).toContain("amanhã");
    expect(m).not.toContain("{");
    expect(m).not.toContain("quota metric");
  });

  it("excesso momentâneo: manda esperar e tentar de novo", () => {
    const m = mensagemDoErro(429, '{"error":{"message":"Resource has been exhausted"}}');
    expect(m).toContain("de novo");
    expect(m).not.toContain("{");
  });

  it("chave errada aponta para a variável certa", () => {
    expect(mensagemDoErro(403, "API key not valid")).toContain("GEMINI_API_KEY");
    expect(mensagemDoErro(401, "unauthorized")).toContain("GEMINI_API_KEY");
  });

  it("bloqueio por conteúdo pede outra descrição", () => {
    expect(mensagemDoErro(400, "blocked by safety settings")).toContain("de outro jeito");
  });

  it("erro do lado deles manda tentar mais tarde", () => {
    expect(mensagemDoErro(503, "service unavailable")).toContain("instável");
  });

  it("erro desconhecido ainda diz o número, sem despejar JSON", () => {
    const m = mensagemDoErro(418, '{"error":{"message":"algo bem estranho aqui"}}');
    expect(m).toContain("418");
    expect(m).not.toContain("estranho");
  });
});
