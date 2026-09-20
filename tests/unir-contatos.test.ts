// "tem 3 leonardos zambom são o mesmo contato (…) os contatos selecionados
//  serão 1 só ficando todas as informações dos 3 em um só, e o que vai ficar
//  é sempre o contato do google"
//
// A regra do vencedor não é detalhe: se a união escolher um cadastro que NÃO
// é o do Google, a sincronização seguinte traz o do Google de volta e a união
// terá sido em vão — o vendedor faria o trabalho duas vezes e o CRM pareceria
// quebrado.

import { describe, it, expect } from "vitest";
import { escolherQueFica, motivoDeQuemFica, pareceMesmaPessoa, palavrasDoNome, type ContatoParaUnir } from "@/lib/unir-contatos-regra";

const c = (p: Partial<ContatoParaUnir> & { id: string }): ContatoParaUnir => ({
  nome: "Leonardo Zambon", telefone: null, googleContatoId: null, googleSincronizadoEm: null,
  criadoEm: new Date("2026-01-01"), ...p,
});

describe("quem fica: o do Google, sempre", () => {
  it("o do Google ganha até de quem tem telefone", () => {
    const fica = escolherQueFica([
      c({ id: "whats", telefone: "28999756575", criadoEm: new Date("2025-01-01") }),
      c({ id: "google", googleContatoId: "people/1" }),
    ]);
    expect(fica?.id).toBe("google");
  });

  it("dois do Google: fica o sincronizado mais recentemente", () => {
    const fica = escolherQueFica([
      c({ id: "velho", googleContatoId: "people/1", googleSincronizadoEm: new Date("2026-01-01") }),
      c({ id: "novo", googleContatoId: "people/2", googleSincronizadoEm: new Date("2026-09-01") }),
    ]);
    expect(fica?.id).toBe("novo");
  });

  it("nenhum do Google: fica o que tem telefone", () => {
    const fica = escolherQueFica([
      c({ id: "sem-fone" }),
      c({ id: "com-fone", telefone: "28999756575" }),
    ]);
    expect(fica?.id).toBe("com-fone");
  });

  it("nenhum do Google e nenhum com telefone: fica o mais antigo", () => {
    const fica = escolherQueFica([
      c({ id: "novo", criadoEm: new Date("2026-06-01") }),
      c({ id: "antigo", criadoEm: new Date("2024-02-02") }),
    ]);
    expect(fica?.id).toBe("antigo");
  });

  it("lista vazia não escolhe ninguém", () => {
    expect(escolherQueFica([])).toBe(null);
  });

  it("a tela explica por que aquele ficou", () => {
    const google = c({ id: "g", googleContatoId: "people/1" });
    expect(motivoDeQuemFica(google, [google])).toMatch(/Google/);
    const fone = c({ id: "f", telefone: "28999756575" });
    expect(motivoDeQuemFica(fone, [fone])).toMatch(/telefone/);
  });
});

describe("quem o CRM sugere unir", () => {
  it("os três Leonardos do print se reconhecem", () => {
    expect(pareceMesmaPessoa("Leonardo Zambon", "leonardo vargas zambon")).toBe(true);
    expect(pareceMesmaPessoa("Leonardo Zambon", "LEONARDO ZAMBON")).toBe(true);
  });

  it("acento e caixa não atrapalham", () => {
    expect(pareceMesmaPessoa("José Antônio Silva", "jose antonio silva")).toBe(true);
  });

  it("só o primeiro nome igual NÃO sugere — senão sugeriria meio CRM", () => {
    expect(pareceMesmaPessoa("Leonardo Zambon", "Leonardo Texeira")).toBe(false);
    expect(pareceMesmaPessoa("João Silva", "João Pereira")).toBe(false);
  });

  it("mas nome de uma palavra só casa com ele mesmo", () => {
    expect(pareceMesmaPessoa("Wadson", "wadson")).toBe(true);
    expect(pareceMesmaPessoa("Wadson", "Ratinho")).toBe(false);
  });

  it("pessoas diferentes não se misturam", () => {
    expect(pareceMesmaPessoa("Leonardo Zambon", "Acacio Pizzol")).toBe(false);
  });

  it("palavras curtas demais não contam (de, da, e)", () => {
    expect(palavrasDoNome("José de Souza e Silva")).toEqual(["jose", "souza", "silva"]);
    // "Maria de Lourdes" x "Ana de Souza": só "de" em comum, que nem conta.
    expect(pareceMesmaPessoa("Maria de Lourdes", "Ana de Souza")).toBe(false);
  });
});
