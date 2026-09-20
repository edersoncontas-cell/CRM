// Ao gerar a arte, a tela mostrava o JSON cru da Google ("You exceeded your
// current quota…"), que não diz ao vendedor o que fazer. Estes testes travam
// a tradução para português.

import { describe, it, expect } from "vitest";
import { mensagemDoErro, noPlanoGratuito, esperaSugerida } from "@/lib/ai/imagem";

// Corpo real de 429 da Google quando a chave está no plano gratuito: o
// quotaMetric e o quotaId trazem "free_tier"/"FreeTier". É o que separa
// "espere um minuto" de "nenhuma espera resolve, a chave é grátis".
const CORPO_GRATUITO = JSON.stringify({
  error: {
    code: 429,
    message: "You exceeded your current quota, please check your plan and billing details.",
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{
          quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
          quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
        }],
      },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "37s" },
    ],
  },
});

const CORPO_PAGO_POR_MINUTO = JSON.stringify({
  error: {
    code: 429,
    message: "Resource has been exhausted (e.g. check quota).",
    status: "RESOURCE_EXHAUSTED",
    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "21s" }],
  },
});

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

// O usuário paga pelo Gemini e mesmo assim levou 429. Assinar o APLICATIVO
// Gemini (Google One / Gemini Advanced) não dá cota de API: são produtos
// separados. Quem libera a API é o faturamento ativo no projeto do Google AI
// Studio de onde saiu a chave. A resposta da Google diz qual dos dois casos é,
// e a tela precisa dizer isso em vez de "espere um minuto".
describe("429 com conta paga: plano gratuito × limite por minuto", () => {
  it("reconhece a marca de plano gratuito no corpo da Google", () => {
    expect(noPlanoGratuito(CORPO_GRATUITO)).toBe(true);
    expect(noPlanoGratuito(CORPO_PAGO_POR_MINUTO)).toBe(false);
  });

  it("plano gratuito: diz quando a arte volta, sem mandar assinar nada", () => {
    // O dono do CRM decidiu ficar no plano gratuito. A mensagem tem de ser
    // útil para quem vai ficar: quando volta. Mandar "ative o faturamento"
    // para quem já disse que não vai pagar é ruído.
    const m = mensagemDoErro(429, CORPO_GRATUITO);
    expect(m).toContain("acabou por hoje");
    expect(m).toMatch(/volta sozinha (hoje|amanhã) às \d{2}:\d{2}|volta sozinha em/);
    expect(m).toContain("texto do post continua funcionando");
    expect(m).not.toContain("{");
  });

  it("explica que assinar o app do Gemini não mexe nesta cota", () => {
    // Quem assina o Gemini no celular acha, com razão, que já pagou pela API.
    // Não pagou: são produtos separados.
    const m = mensagemDoErro(429, CORPO_GRATUITO);
    expect(m).toContain("Google One");
    expect(m).toContain("não aumenta esta cota");
  });

  it("plano gratuito não manda esperar um minuto, porque não é disso que se trata", () => {
    expect(mensagemDoErro(429, CORPO_GRATUITO)).not.toContain("Espere um minuto");
  });

  it("limite por minuto: repete a espera que a própria Google pediu", () => {
    expect(esperaSugerida(CORPO_PAGO_POR_MINUTO)).toBe(21);
    const m = mensagemDoErro(429, CORPO_PAGO_POR_MINUTO);
    expect(m).toContain("21s");
    expect(m).toContain("não acabou");
  });

  it("sem retryDelay no corpo, não inventa número", () => {
    expect(esperaSugerida('{"error":{"message":"Resource has been exhausted"}}')).toBe(null);
  });
});
