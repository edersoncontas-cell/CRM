// Os dois provedores de arte, integrados: quando um não dá, o outro faz.
//
// O que está em jogo aqui é DINHEIRO. O Gemini tem camada gratuita; a OpenAI
// não tem — é pré-paga e cobra por imagem. Então duas regras precisam estar
// certas:
//
//   1. o Gemini é sempre tentado primeiro, para o uso normal custar zero;
//   2. a OpenAI só é chamada quando a falha é do PROVEDOR (cota, queda, chave).
//      Se o pedido é que foi recusado por conteúdo, a OpenAI recusaria igual —
//      e essa tentativa inútil viria na fatura.

import { describe, it, expect } from "vitest";
import { ordemDosProvedores, vaiTentarOProximo } from "@/lib/ai/imagem-escolha";

const ambos = { gemini: true, openai: true };

describe("ordem dos provedores", () => {
  it("por padrão o grátis vem primeiro — é o que mantém a conta em zero", () => {
    expect(ordemDosProvedores(undefined, ambos)).toEqual(["gemini", "openai"]);
    expect(ordemDosProvedores("", ambos)).toEqual(["gemini", "openai"]);
  });

  it("só lista provedor que está configurado", () => {
    expect(ordemDosProvedores(undefined, { gemini: true, openai: false })).toEqual(["gemini"]);
    expect(ordemDosProvedores(undefined, { gemini: false, openai: true })).toEqual(["openai"]);
    expect(ordemDosProvedores(undefined, { gemini: false, openai: false })).toEqual([]);
  });

  it("dá para inverter de propósito (sabendo que aí se paga sempre)", () => {
    expect(ordemDosProvedores("openai,gemini", ambos)).toEqual(["openai", "gemini"]);
    expect(ordemDosProvedores("OpenAI, Gemini", ambos)).toEqual(["openai", "gemini"]);
  });

  it("dá para usar só um", () => {
    expect(ordemDosProvedores("openai", ambos)).toEqual(["openai"]);
  });

  it("lixo na configuração cai no padrão em vez de deixar sem arte", () => {
    expect(ordemDosProvedores("midjourney,", ambos)).toEqual(["gemini", "openai"]);
    expect(ordemDosProvedores(",,,", ambos)).toEqual(["gemini", "openai"]);
  });

  it("nome repetido não faz tentar duas vezes (nem cobrar duas vezes)", () => {
    expect(ordemDosProvedores("openai,openai,gemini", ambos)).toEqual(["openai", "gemini"]);
  });
});

describe("vale gastar uma chamada no próximo provedor?", () => {
  it("sim quando o problema é do provedor", () => {
    expect(vaiTentarOProximo(429)).toBe(true);                 // sem cota aqui
    expect(vaiTentarOProximo(500)).toBe(true);                 // provedor instável
    expect(vaiTentarOProximo(503)).toBe(true);
    expect(vaiTentarOProximo(404)).toBe(true);                 // modelo sumiu
    expect(vaiTentarOProximo(401)).toBe(true);                 // chave deste recusada
    expect(vaiTentarOProximo(403)).toBe(true);
    expect(vaiTentarOProximo(undefined)).toBe(true);           // rede/timeout
  });

  it("NÃO quando o pedido é que foi recusado — pagar por recusa certa", () => {
    expect(vaiTentarOProximo(400, "blocked by safety settings")).toBe(false);
    expect(vaiTentarOProximo(400, '{"error":{"code":"content_policy_violation"}}')).toBe(false);
    expect(vaiTentarOProximo(400, "moderation flagged this prompt")).toBe(false);
  });

  it("400 que não é de conteúdo ainda vale tentar no outro", () => {
    // Ex.: um provedor não aceita certo formato de imagem de referência; o
    // outro pode aceitar.
    expect(vaiTentarOProximo(400, "unsupported image format")).toBe(true);
  });

  it("erro do cliente sem relação não sai tentando à toa", () => {
    expect(vaiTentarOProximo(413)).toBe(false);
    expect(vaiTentarOProximo(422)).toBe(false);
  });
});
