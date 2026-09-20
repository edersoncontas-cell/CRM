// "Ainda está dando erro por conta de limite, que limite é esse? Você consegue
//  resolver isso ou não?"
//
// Consigo, e a causa é aritmética pura. A análise do Orientador mandava:
//
//   histórico 120.000 + prompt 12.000 + contexto 6.000 = 138.000 caracteres
//   ≈ 34.500 tokens de ENTRADA
//
// O limite POR MINUTO da camada gratuita do Groq é de 6.000 a 12.000 tokens,
// por modelo. Ou seja: o pedido era de quatro a seis vezes MAIOR que o teto do
// minuto. Não era uso excessivo — ELE NUNCA COUBE. Por isso nenhuma espera
// resolvia: o CRM tentava os nove modelos, tomava 429 em todos, dizia "volta
// em 1 minuto", e um minuto depois acontecia exatamente a mesma coisa.
//
// A janela de 120 mil está certa para o Gemini (janela de 1 milhão de tokens).
// O erro foi aplicar o mesmo tamanho a um provedor cujo teto é 6 mil.

import { describe, it, expect } from "vitest";
import {
  janelaDeCaracteres, janelaApertada, TETO_ENTRADA, CHARS_POR_TOKEN,
  JANELA_MINIMA_CHARS, RESERVA_RESPOSTA_TOKENS, RESERVA_PROMPT_CHARS, cabeNoProvedor,
} from "@/lib/ai/orcamento-prompt";

const CHEIA = 120_000;

describe("o tamanho que cabe em cada provedor", () => {
  it("no Groq gratuito, a janela ENCOLHE — senão o pedido nunca passa", () => {
    const j = janelaDeCaracteres(["groq"], CHEIA);
    expect(j).toBeLessThan(CHEIA);
    expect(janelaApertada(["groq"], CHEIA)).toBe(true);
  });

  it("e o pedido inteiro passa a caber no teto por minuto do Groq", () => {
    const janela = janelaDeCaracteres(["groq"], CHEIA);
    const tokensEntrada = (janela + RESERVA_PROMPT_CHARS) / CHARS_POR_TOKEN;
    const tokensTotais = tokensEntrada + RESERVA_RESPOSTA_TOKENS;
    // Esta é a asserção que resolve o defeito: o total tem de caber no TPM.
    expect(tokensTotais).toBeLessThanOrEqual(TETO_ENTRADA.groq);
  });

  it("no Gemini, a janela cheia é mantida — o pedido do vendedor continua valendo", () => {
    // "a IA tem de ler a conversa inteira, não só o fim" continua verdade
    // onde há espaço para isso.
    expect(janelaDeCaracteres(["gemini"], CHEIA)).toBe(CHEIA);
    expect(janelaApertada(["gemini"], CHEIA)).toBe(false);
  });

  it("com Gemini E Groq, manda quem atende primeiro — o Gemini", () => {
    expect(janelaDeCaracteres(["gemini", "groq"], CHEIA)).toBe(CHEIA);
  });

  it("com Groq primeiro e Gemini de reserva, aperta pelo Groq", () => {
    expect(janelaDeCaracteres(["groq", "gemini"], CHEIA)).toBeLessThan(CHEIA);
  });

  it("os pagos têm folga e não apertam", () => {
    expect(janelaDeCaracteres(["openai"], CHEIA)).toBe(CHEIA);
    expect(janelaDeCaracteres(["anthropic"], CHEIA)).toBe(CHEIA);
  });
});

describe("os limites da conta", () => {
  it("nunca encolhe abaixo do piso — trecho picado demais não vira análise", () => {
    expect(janelaDeCaracteres(["groq"], CHEIA)).toBeGreaterThanOrEqual(JANELA_MINIMA_CHARS);
  });

  it("sem provedor nenhum, não há o que dimensionar", () => {
    expect(janelaDeCaracteres([], CHEIA)).toBe(CHEIA);
  });

  it("janela já pequena não é aumentada", () => {
    expect(janelaDeCaracteres(["gemini"], 5_000)).toBe(5_000);
  });

  it("a janela devolvida é sempre um número utilizável", () => {
    for (const p of ["gemini", "groq", "deepseek", "openai", "anthropic"] as const) {
      const j = janelaDeCaracteres([p], CHEIA);
      expect(Number.isFinite(j)).toBe(true);
      expect(j).toBeGreaterThan(0);
    }
  });
});

describe("a conta que explica o defeito", () => {
  it("o pedido ANTIGO não cabia em nenhum modelo gratuito do Groq", () => {
    const antigo = (CHEIA + RESERVA_PROMPT_CHARS) / CHARS_POR_TOKEN;
    expect(antigo).toBeGreaterThan(35_000);
    // Três vezes o teto do MELHOR modelo gratuito ainda utilizável (12.000
    // TPM), e quase seis vezes o dos menores (6.000). Não era "quase
    // cabendo": era impossível por uma margem enorme, em qualquer um deles.
    expect(antigo / TETO_ENTRADA.groq).toBeGreaterThan(2.5);
    expect(antigo / 6_000).toBeGreaterThan(5);
  });

  it("o prompt de instruções sozinho já é enorme para a camada gratuita", () => {
    // Medido: montarPromptOrientador com tudo vazio dá 21.833 caracteres.
    // É isso que impede o Orientador completo de rodar nos modelos de 6.000
    // TPM: a instrução consome o teto antes de entrar uma linha de conversa.
    const soInstrucao = RESERVA_PROMPT_CHARS / CHARS_POR_TOKEN;
    expect(soInstrucao).toBeGreaterThan(5_000);
  });
});

describe("quando o pedido NÃO cabe de jeito nenhum", () => {
  it("o Groq com o teto atual ainda comporta o pedido mínimo", () => {
    expect(cabeNoProvedor("groq")).toBe(true);
  });

  it("os demais comportam com folga", () => {
    for (const p of ["gemini", "deepseek", "openai", "anthropic"] as const) {
      expect(cabeNoProvedor(p)).toBe(true);
    }
  });
});
