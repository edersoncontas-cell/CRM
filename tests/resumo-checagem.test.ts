// A trava contra o resumo inventado.
//
// Defeito reportado com print: "Cliente enviou documentos e combinou contato
// para segunda-feira, mas ainda não confirmou visita presencial." — e o
// cliente não tinha enviado documento nenhum.
//
// Prompt é pedido, não trava. O CRM SABE o que foi anexado e de que lado veio,
// então a frase pode ser conferida contra o fato e derrubada quando não se
// sustenta. Estes testes cuidam dos dois lados do risco: derrubar o que é
// invenção, e NÃO derrubar o que é verdade.

import { describe, it, expect } from "vitest";
import { fraseSemApoio, resumoConferido, frasesDerrubadas, emFrases } from "@/lib/zeus/resumo-checagem";
import type { MidiaDaConversa } from "@/lib/zeus/historico-linha";

const midia = (cliente: string[] = [], vendedor: string[] = []): MidiaDaConversa =>
  ({ cliente: new Set(cliente as never), vendedor: new Set(vendedor as never) });

const SEM_NADA = midia();
const CLIENTE_MANDOU_DOC = midia(["documento"]);
const SO_VENDEDOR_MANDOU_DOC = midia([], ["documento"]);

describe("o caso do print", () => {
  const frase = "Cliente enviou documentos e combinou contato para segunda-feira.";

  it("cai quando não há documento nenhum na conversa", () => {
    expect(fraseSemApoio(frase, SEM_NADA)).toBe(true);
  });

  it("cai também quando quem mandou o documento foi o VENDEDOR", () => {
    // Este é o caso mais traiçoeiro: existe documento na conversa, mas não do
    // lado que a frase afirma.
    expect(fraseSemApoio(frase, SO_VENDEDOR_MANDOU_DOC)).toBe(true);
  });

  it("FICA quando o cliente realmente mandou documento", () => {
    expect(fraseSemApoio(frase, CLIENTE_MANDOU_DOC)).toBe(false);
  });
});

describe("o que NÃO pode ser derrubado", () => {
  it("frase sem verbo de envio passa", () => {
    expect(fraseSemApoio("Cliente quer a escavadeira E145C por R$ 610.000.", SEM_NADA)).toBe(false);
    expect(fraseSemApoio("Falta a documentação para o financiamento.", SEM_NADA)).toBe(false);
  });

  it("frase sem palavra de anexo passa", () => {
    expect(fraseSemApoio("Cliente enviou uma mensagem perguntando o prazo.", SEM_NADA)).toBe(false);
    expect(fraseSemApoio("Você mandou o preço antes de qualificar.", SEM_NADA)).toBe(false);
  });

  it("o vendedor ter enviado proposta em PDF fica, quando ele enviou mesmo", () => {
    expect(fraseSemApoio("Você enviou a proposta em PDF.", SO_VENDEDOR_MANDOU_DOC)).toBe(false);
  });

  it("frase sobre foto fica quando o cliente mandou foto", () => {
    expect(fraseSemApoio("Cliente mandou fotos da obra.", midia(["foto"]))).toBe(false);
  });

  it("frase sobre foto cai quando ninguém mandou foto", () => {
    expect(fraseSemApoio("Cliente mandou fotos da obra.", CLIENTE_MANDOU_DOC)).toBe(true);
  });

  it("áudio do cliente é reconhecido", () => {
    expect(fraseSemApoio("Cliente mandou um áudio explicando a aplicação.", midia(["audio"]))).toBe(false);
    expect(fraseSemApoio("Cliente mandou um áudio explicando a aplicação.", SEM_NADA)).toBe(true);
  });
});

describe("frase sem sujeito claro", () => {
  it("cai só quando NINGUÉM enviou aquele tipo", () => {
    expect(fraseSemApoio("Documentos foram enviados.", SEM_NADA)).toBe(true);
    expect(fraseSemApoio("Documentos foram enviados.", SO_VENDEDOR_MANDOU_DOC)).toBe(false);
    expect(fraseSemApoio("Documentos foram enviados.", CLIENTE_MANDOU_DOC)).toBe(false);
  });
});

describe("o resumo depois da conferência", () => {
  const resumo = "Wadson quer a escavadeira E145C por R$ 610.000 financiada. Cliente enviou os documentos. Falta alinhar o preço final.";

  it("sai sem a frase inventada e com o resto intacto", () => {
    const r = resumoConferido(resumo, SEM_NADA);
    expect(r).toContain("Wadson quer a escavadeira E145C");
    expect(r).toContain("Falta alinhar o preço final");
    expect(r).not.toContain("enviou os documentos");
  });

  it("a frase derrubada é devolvida para o log, para dar para medir", () => {
    expect(frasesDerrubadas(resumo, SEM_NADA)).toEqual(["Cliente enviou os documentos."]);
  });

  it("resumo todo certo passa inteiro", () => {
    const r = resumoConferido(resumo, CLIENTE_MANDOU_DOC);
    expect(r).toBe(resumo);
  });

  it("se TUDO cair, devolve vazio — card sem resumo é melhor que card inventado", () => {
    expect(resumoConferido("Cliente enviou os documentos.", SEM_NADA)).toBe("");
  });

  it("resumo vazio não quebra", () => {
    expect(resumoConferido("", SEM_NADA)).toBe("");
    expect(resumoConferido(null, SEM_NADA)).toBe("");
    expect(resumoConferido(undefined, SEM_NADA)).toBe("");
  });
});

describe("quebra em frases", () => {
  it("separa por ponto, interrogação e quebra de linha", () => {
    expect(emFrases("Uma. Duas! Três?")).toEqual(["Uma.", "Duas!", "Três?"]);
    expect(emFrases("Uma\nDuas")).toEqual(["Uma", "Duas"]);
  });

  it("não inventa frase a partir de texto vazio", () => {
    expect(emFrases("")).toEqual([]);
    expect(emFrases("   ")).toEqual([]);
  });
});
