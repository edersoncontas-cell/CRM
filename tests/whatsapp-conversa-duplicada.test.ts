// O contato aparecia REPETIDO na lista do WhatsApp — uma linha por mídia do
// mesmo álbum — e ao abrir uma delas só tinha uma foto. Causa: o índice único
// é no texto exato do externalPhone, mas a busca da conversa é por variantes
// do número e pelo @lid; com vários webhooks chegando juntos, dois eventos do
// mesmo contato resolviam para textos diferentes porém equivalentes e os dois
// create passavam.
//
// Aqui ficam os testes das partes PURAS: as chaves de identidade (que são o
// que faz dois eventos do mesmo contato travarem no mesmo lugar) e a
// unificação das conversas que já nasceram partidas.

import { describe, it, expect } from "vitest";
import { chavesDeIdentidade, chaveCanonicaTelefone, hash32, somenteDigitos } from "@/lib/whatsapp-routing";
import { agruparPorIdentidade, escolherSobrevivente, fundirCampos } from "@/lib/whatsapp-dedupe";

const LID = "209384756102938@lid";

function conv(over: Partial<Parameters<typeof escolherSobrevivente>[0][number]> = {}) {
  return {
    id: "c1", externalPhone: "5527999183562", lid: null, isGroup: false,
    contactName: null, groupName: null, status: "UNASSIGNED", category: null,
    categoryConfirmed: false, aiActive: false, encerrada: false,
    lastMessageAt: new Date("2026-09-19T21:18:00Z"), lastAccessedAt: null,
    contactPhotoUrl: null, agnesScheduledAt: null, clienteId: null,
    createdAt: new Date("2026-09-19T21:18:00Z"),
    ...over,
  };
}

describe("chave de identidade do contato", () => {
  it("o mesmo celular com e sem o 9º dígito dá a MESMA chave", () => {
    // Era esta a corrida: os dois textos são do mesmo contato, mas o índice
    // único os tratava como contatos diferentes.
    expect(chaveCanonicaTelefone("5527999183562")).toBe(chaveCanonicaTelefone("552799183562"));
    expect(chaveCanonicaTelefone("5527999183562")).toBe(chaveCanonicaTelefone("27999183562"));
    expect(chaveCanonicaTelefone("5527999183562")).toBe(chaveCanonicaTelefone("2799183562"));
  });

  it("contatos diferentes dão chaves diferentes", () => {
    expect(chaveCanonicaTelefone("5527999183562")).not.toBe(chaveCanonicaTelefone("5527988887777"));
  });

  it("evento com telefone E @lid trava nas duas chaves", () => {
    // É o que costura o evento que só traz o @lid com o que traz o número.
    const comAmbos = chavesDeIdentidade({ phone: "5527999183562", lid: LID, isGroup: false });
    const soTelefone = chavesDeIdentidade({ phone: "552799183562", lid: null, isGroup: false });
    const soLid = chavesDeIdentidade({ phone: "209384756102938", lid: LID, isGroup: false });

    expect(comAmbos).toHaveLength(2);
    expect(comAmbos.some((c) => soTelefone.includes(c))).toBe(true);
    expect(comAmbos.some((c) => soLid.includes(c))).toBe(true);
  });

  it("vem sempre ordenado (é o que evita uma trava esperar a outra)", () => {
    const k = chavesDeIdentidade({ phone: "5527999183562", lid: LID, isGroup: false });
    expect([...k].sort()).toEqual(k);
  });

  it("grupo trava só pelo próprio id do grupo", () => {
    expect(chavesDeIdentidade({ phone: "1234-group@g.us", lid: null, isGroup: true })).toEqual(["g:1234-group@g.us"]);
  });

  it("somenteDigitos tira o @lid e o sufixo de aparelho", () => {
    expect(somenteDigitos("209384756102938@lid")).toBe("209384756102938");
    expect(somenteDigitos("5527999183562:12@s.whatsapp.net")).toBe("5527999183562");
  });

  it("hash32 é estável e cabe num int de 32 bits", () => {
    const h = hash32("tel:5527999183562");
    expect(h).toBe(hash32("tel:5527999183562"));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(h).toBeLessThan(2 ** 31);
  });
});

describe("unificação das conversas duplicadas", () => {
  it("agrupa as variantes do mesmo número", () => {
    const grupos = agruparPorIdentidade([
      conv({ id: "a", externalPhone: "5527999183562" }),
      conv({ id: "b", externalPhone: "552799183562" }),
      conv({ id: "c", externalPhone: "2799183562" }),
      conv({ id: "z", externalPhone: "5527988887777" }), // outro contato
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("o @lid costura a conversa que nasceu sem telefone", () => {
    const grupos = agruparPorIdentidade([
      conv({ id: "a", externalPhone: "5527999183562" }),
      conv({ id: "b", externalPhone: "5527999183562x", lid: LID }), // tem os dois
      conv({ id: "c", externalPhone: "209384756102938", lid: LID }), // só o @lid
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toHaveLength(3);
  });

  it("NÃO junta um @lid solto que nada liga ao número — seria chute", () => {
    const grupos = agruparPorIdentidade([
      conv({ id: "a", externalPhone: "5527999183562" }),
      conv({ id: "c", externalPhone: "209384756102938", lid: LID }),
    ]);
    expect(grupos).toHaveLength(0);
  });

  it("sobrevive a mais antiga que dê para responder", () => {
    const soLid = conv({ id: "lid", externalPhone: "209384756102938", lid: LID, createdAt: new Date("2020-01-01") });
    const antiga = conv({ id: "antiga", createdAt: new Date("2026-01-01") });
    const nova = conv({ id: "nova", createdAt: new Date("2026-09-01") });
    // mesmo sendo a mais velha, a que só tem @lid não pode ser a escolhida:
    // ninguém consegue responder por ela
    expect(escolherSobrevivente([soLid, nova, antiga]).id).toBe("antiga");
  });

  it("a fusão não perde informação", () => {
    const sobrevivente = conv({ id: "s", contactName: null, clienteId: null });
    const outra = conv({
      id: "o", contactName: "Elton Cp", clienteId: "cli1", lid: LID, aiActive: true,
      contactPhotoUrl: "foto.jpg", category: "quente", categoryConfirmed: true, status: "OPEN",
      lastMessageAt: new Date("2026-09-20T10:00:00Z"),
      createdAt: new Date("2020-01-01"),
    });
    const patch = fundirCampos(sobrevivente, [sobrevivente, outra]);

    expect(patch.contactName).toBe("Elton Cp");
    expect(patch.clienteId).toBe("cli1");
    expect(patch.lid).toBe(LID);
    expect(patch.aiActive).toBe(true);
    expect(patch.contactPhotoUrl).toBe("foto.jpg");
    expect(patch.category).toBe("quente");
    expect(patch.status).toBe("OPEN");
    expect(patch.lastMessageAt).toEqual(new Date("2026-09-20T10:00:00Z"));
    expect(patch.createdAt).toEqual(new Date("2020-01-01"));
    // o resumo do PDF foi feito só sobre um pedaço da conversa
    expect(patch.resumoRelatorio).toBeNull();
  });

  it("nome de verdade nunca é trocado por número", () => {
    const sobrevivente = conv({ id: "s", contactName: "Elton Cp" });
    const outra = conv({ id: "o", contactName: "+55 27 99918-3562" });
    expect(fundirCampos(sobrevivente, [sobrevivente, outra]).contactName).toBeUndefined();
  });

  it("basta uma pendente para a conversa unificada continuar pendente", () => {
    const sobrevivente = conv({ id: "s", encerrada: true });
    const outra = conv({ id: "o", encerrada: false });
    expect(fundirCampos(sobrevivente, [sobrevivente, outra]).encerrada).toBe(false);
  });

  it("todas encerradas → segue encerrada", () => {
    const sobrevivente = conv({ id: "s", encerrada: true });
    const outra = conv({ id: "o", encerrada: true });
    expect(fundirCampos(sobrevivente, [sobrevivente, outra]).encerrada).toBeUndefined();
  });
});
