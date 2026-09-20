// "Pronto, vai continuar gratuito né?"
//
// Não automaticamente — e é por isso que esta trava existe.
//
// O vendedor ligou as cinco chaves achando que somava cinco cotas gratuitas.
// Só DUAS são gratuitas de verdade na API: Gemini e Groq. DeepSeek, OpenAI e
// Anthropic são PRÉ-PAGAS, cobram por uso.
//
// Como a cascata tenta em ordem, o risco era preciso e silencioso: nos dias em
// que Gemini e Groq batem no limite — que é exatamente o que vinha
// acontecendo todo dia — o CRM cairia no terceiro da fila e começaria a
// gastar. Ninguém pediu, ninguém vê, e a conta chega no fim do mês.
//
// O que estes testes protegem é o dinheiro de alguém. A regra é: ausência de
// escolha NUNCA vira fatura.

import { describe, it, expect } from "vitest";
import { GRATUITO, ORDEM_PROVEDORES, type ProvedorId } from "@/lib/ai/provedores-status";

/** Espelha o filtro de provedoresDisponiveis (lib/ai/index.ts). */
const comTrava = (todos: ProvedorId[], soGratis: boolean): ProvedorId[] =>
  soGratis ? todos.filter((p) => GRATUITO[p]) : todos;

const TODOS: ProvedorId[] = ["gemini", "groq", "deepseek", "openai", "anthropic"];

describe("quem cobra e quem não cobra", () => {
  it("só Gemini e Groq têm camada gratuita na API", () => {
    const gratis = ORDEM_PROVEDORES.filter((p) => GRATUITO[p]);
    expect(gratis).toEqual(["gemini", "groq"]);
  });

  it("os outros três são pagos — e estavam na fila como 3º, 4º e 5º", () => {
    expect(GRATUITO.deepseek).toBe(false);
    expect(GRATUITO.openai).toBe(false);
    expect(GRATUITO.anthropic).toBe(false);
  });
});

describe("a trava ligada (padrão)", () => {
  it("deixa passar só os gratuitos", () => {
    expect(comTrava(TODOS, true)).toEqual(["gemini", "groq"]);
  });

  it("o CRM não tem como chegar num provedor pago", () => {
    for (const p of comTrava(TODOS, true)) expect(GRATUITO[p]).toBe(true);
  });

  it("com os gratuitos ausentes, a lista fica VAZIA em vez de cair no pago", () => {
    // É a consequência da trava, e é intencional: o Orientador espera a cota
    // voltar em vez de gerar custo por conta própria.
    expect(comTrava(["deepseek", "openai", "anthropic"], true)).toEqual([]);
  });
});

describe("a trava desligada", () => {
  it("a fila inteira volta, na ordem", () => {
    expect(comTrava(TODOS, false)).toEqual(TODOS);
  });

  it("os gratuitos continuam vindo PRIMEIRO — o pago é socorro, não escolha", () => {
    const fila = comTrava(TODOS, false);
    expect(GRATUITO[fila[0]]).toBe(true);
    expect(GRATUITO[fila[1]]).toBe(true);
  });
});
