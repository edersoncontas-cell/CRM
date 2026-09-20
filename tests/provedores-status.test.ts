// "Quero, pode verificar e traga a solução e a faça."
//
// A tela mostrava só o nome do PRIMEIRO provedor ("Groq (grátis)"), o que não
// responde a pergunta que importa: e se ele cair? Com um provedor só, qualquer
// rajada de limite por minuto derruba o Orientador e o painel congela na
// leitura anterior — foi o que aconteceu, e não havia como ver isso em lugar
// nenhum do CRM.
//
// Agora a tela do ZEUS mostra a fila inteira. Estes testes cuidam da leitura.

import { describe, it, expect } from "vitest";
import { diagnosticoIA, ORDEM_PROVEDORES } from "@/lib/ai/provedores-status";

describe("a fila de provedores", () => {
  it("mostra todos, configurados ou não", () => {
    const d = diagnosticoIA(["groq"]);
    expect(d.linhas).toHaveLength(ORDEM_PROVEDORES.length);
    expect(d.linhas.map((l) => l.id)).toEqual(ORDEM_PROVEDORES);
  });

  it("numera só os configurados, na ordem em que o CRM tenta", () => {
    const d = diagnosticoIA(["groq", "openai"]);
    expect(d.linhas.find((l) => l.id === "groq")?.posicao).toBe(1);
    expect(d.linhas.find((l) => l.id === "openai")?.posicao).toBe(2);
    expect(d.linhas.find((l) => l.id === "gemini")?.posicao).toBe(null);
  });

  it("o Gemini vem antes do Groq quando os dois existem", () => {
    const d = diagnosticoIA(["groq", "gemini"]);
    expect(d.linhas.find((l) => l.id === "gemini")?.posicao).toBe(1);
    expect(d.linhas.find((l) => l.id === "groq")?.posicao).toBe(2);
  });

  it("diz quais têm camada gratuita de verdade na API", () => {
    const d = diagnosticoIA([]);
    const grat = d.linhas.filter((l) => l.gratuito).map((l) => l.id);
    expect(grat).toEqual(["gemini", "groq"]);
  });

  it("nunca expõe a chave em si, só o nome da variável", () => {
    const d = diagnosticoIA(["groq"]);
    expect(d.linhas.find((l) => l.id === "gemini")?.chave).toBe("GEMINI_API_KEY");
    expect(JSON.stringify(d)).not.toMatch(/sk-|AIza|gsk_/);
  });
});

describe("o diagnóstico", () => {
  it("UM provedor só é o caso de risco — foi o que derrubou o Orientador", () => {
    const d = diagnosticoIA(["groq"]);
    expect(d.quantos).toBe(1);
    expect(d.risco).toMatch(/para onde cair/i);
    expect(d.risco).toContain("Groq");
    expect(d.solucao).toContain("GEMINI_API_KEY");
  });

  it("a reserva sugerida é sempre uma gratuita, para não criar conta nova", () => {
    // Ele já disse que não paga assinatura a mais; sugerir OpenAI seria
    // empurrar fatura.
    expect(diagnosticoIA(["groq"]).solucao).toContain("GEMINI_API_KEY");
    expect(diagnosticoIA(["gemini"]).solucao).toContain("GROQ_API_KEY");
  });

  it("nenhum provedor é o caso mais grave", () => {
    const d = diagnosticoIA([]);
    expect(d.quantos).toBe(0);
    expect(d.risco).toMatch(/não consegue analisar/i);
    expect(d.solucao).toContain("GEMINI_API_KEY");
  });

  it("dois ou mais: sem risco, e o resumo mostra a cascata", () => {
    const d = diagnosticoIA(["gemini", "groq"]);
    expect(d.risco).toBe(null);
    expect(d.solucao).toBe(null);
    expect(d.resumo).toContain("Google Gemini → Groq");
  });

  it("o resumo de um provedor só deixa claro que não há reserva", () => {
    expect(diagnosticoIA(["groq"]).resumo).toMatch(/sem reserva/i);
  });
});
