// Ligar um provedor de IA novo pela tela do CRM, sem abrir a Vercel.
//
// "O que você consegue fazer para otimizar para que eu consiga usar
//  despreocupado a ferramenta" — e, junto, a pergunta sobre me dar acesso à
//  conta da Vercel.
//
// A resposta melhor para as duas é a mesma: tirar a Vercel do caminho. Trocar
// de provedor deixa de exigir painel de hospedagem, variável de ambiente e
// deploy novo, e passa a ser colar a chave numa tela, do celular. Ninguém
// precisa de acesso à conta de ninguém.
//
// O que estes testes protegem: uma chave de API é credencial. Não pode
// aparecer inteira na tela, não pode ir para log, e lixo colado sem querer
// não pode virar "provedor configurado" — senão o CRM acha que tem reserva e
// descobre que não tem justamente na hora do limite.

import { describe, it, expect } from "vitest";
import { mascarar, chaveParece, limparChave, chaveConfig } from "@/lib/ai/chaves";

describe("a chave nunca aparece inteira", () => {
  it("mostra só as pontas, o suficiente para conferir que colou a certa", () => {
    const m = mascarar("AIzaSyD-1234567890abcdefghijklmn");
    expect(m).toBe("AIza••••••••klmn");
    expect(m).not.toContain("1234567890");
  });

  it("chave curta é mascarada inteira, sem dar pista", () => {
    expect(mascarar("abc123")).toBe("••••••");
  });

  it("sem chave, não inventa máscara", () => {
    expect(mascarar(null)).toBe(null);
    expect(mascarar(undefined)).toBe(null);
    expect(mascarar("")).toBe(null);
    expect(mascarar("   ")).toBe(null);
  });
});

describe("o que conta como chave de verdade", () => {
  it("chave real passa", () => {
    expect(chaveParece("AIzaSyD-1234567890abcdefghijklmn")).toBe(true);
    expect(chaveParece("gsk_abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
  });

  it("texto curto demais não passa", () => {
    expect(chaveParece("abc")).toBe(false);
    expect(chaveParece("")).toBe(false);
  });

  it("espaço no meio denuncia copiar-colar quebrado", () => {
    expect(chaveParece("AIzaSyD 1234567890abcdefghij")).toBe(false);
  });

  it("texto de exemplo não vira chave — o CRM acharia que tem reserva", () => {
    expect(chaveParece("sua-chave-aqui")).toBe(false);
    expect(chaveParece("COLE")).toBe(false);
    expect(chaveParece("xxxxxxxxxxxxxxxxxxx")).toBe(false);
  });

  it("aspas grudadas no copiar-colar são toleradas", () => {
    expect(chaveParece('"AIzaSyD-1234567890abcdefghijklmn"')).toBe(true);
    expect(limparChave('"AIzaSyD-1234567890abcdefghij"')).toBe("AIzaSyD-1234567890abcdefghij");
    expect(limparChave("  gsk_abcdefghijklmnop  ")).toBe("gsk_abcdefghijklmnop");
  });
});

describe("onde a chave fica guardada", () => {
  it("uma linha por provedor, com prefixo próprio", () => {
    expect(chaveConfig("gemini")).toBe("ia.chave.gemini");
    expect(chaveConfig("groq")).toBe("ia.chave.groq");
  });

  it("o nome da linha não carrega a chave", () => {
    expect(chaveConfig("gemini")).not.toMatch(/AIza|sk-|gsk_/);
  });
});
