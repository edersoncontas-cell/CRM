import { describe, it, expect } from "vitest";
import { limiteMensagens, limiteImportacao, ultimaExclusaoQueVale, mensagemAntiga, inicioDoDiaBrasilia, diaBrasiliaISO, desdeDaImportacao, DESDE_TUDO } from "../src/lib/whatsapp-corte-regra";

describe("data de corte e exclusão de conversas do WhatsApp", () => {
  const corte = new Date("2026-09-16T03:00:00Z");
  const exclusao = new Date("2026-09-20T15:00:00Z");

  it("sem corte nem exclusão, tudo entra", () => {
    expect(limiteMensagens(null, null)).toBeNull();
    expect(mensagemAntiga(new Date("2020-01-01T00:00:00Z"), null)).toBe(false);
  });

  it("usa o mais recente entre corte global e exclusão da conversa", () => {
    expect(limiteMensagens(corte, exclusao)).toEqual(exclusao);
    expect(limiteMensagens(exclusao, corte)).toEqual(exclusao);
    expect(limiteMensagens(corte, null)).toEqual(corte);
    expect(limiteMensagens(null, exclusao)).toEqual(exclusao);
  });

  it("mensagem de antes do limite é antiga; do limite em diante entra", () => {
    expect(mensagemAntiga(new Date("2026-09-15T23:59:00Z"), corte)).toBe(true);
    expect(mensagemAntiga(corte, corte)).toBe(false);
    expect(mensagemAntiga(new Date("2026-09-16T12:00:00Z"), corte)).toBe(false);
  });

  it("histórico reenviado depois da exclusão fica de fora, mensagem nova entra", () => {
    const limite = limiteMensagens(corte, exclusao);
    expect(mensagemAntiga(new Date("2026-09-18T10:00:00Z"), limite)).toBe(true);
    expect(mensagemAntiga(new Date("2026-09-20T15:00:01Z"), limite)).toBe(false);
  });

  it("início do dia em Brasília é 03:00 UTC e volta ao mesmo dia", () => {
    const d = inicioDoDiaBrasilia("2026-09-16");
    expect(d.toISOString()).toBe("2026-09-16T03:00:00.000Z");
    expect(diaBrasiliaISO(d)).toBe("2026-09-16");
    expect(diaBrasiliaISO(new Date("2026-09-16T02:59:00Z"))).toBe("2026-09-15");
  });
});

describe("importar do celular: exclusão pelo corte x exclusão manual", () => {
  const corte = new Date("2026-09-16T03:00:00Z");
  const peloCorte = { excluidaEm: corte, motivo: "corte" };
  const manual = { excluidaEm: new Date("2026-09-17T14:00:00Z"), motivo: "manual" };

  it("na regra normal, as duas exclusões contam e vale a mais recente", () => {
    expect(ultimaExclusaoQueVale([peloCorte, manual], false)).toEqual(manual.excluidaEm);
    expect(ultimaExclusaoQueVale([peloCorte], false)).toEqual(corte);
  });

  it("importando de antes do corte, a exclusão do corte não barra — a manual continua barrando", () => {
    expect(ultimaExclusaoQueVale([peloCorte], true)).toBeNull();
    expect(ultimaExclusaoQueVale([peloCorte, manual], true)).toEqual(manual.excluidaEm);
    expect(ultimaExclusaoQueVale([], true)).toBeNull();
  });

  it("limite da importação: a data escolhida manda; sem ela vale o corte", () => {
    const desde = new Date("2026-09-01T03:00:00Z");
    expect(limiteImportacao(desde, corte, null)).toEqual(desde);
    expect(limiteImportacao(null, corte, null)).toEqual(corte);
    expect(limiteImportacao(null, null, null)).toBeNull();
    // Conversa apagada à mão depois da data escolhida: só volta o que é posterior à exclusão.
    expect(limiteImportacao(desde, corte, manual.excluidaEm)).toEqual(manual.excluidaEm);
    expect(mensagemAntiga(new Date("2026-09-10T12:00:00Z"), limiteImportacao(desde, corte, null))).toBe(false);
    expect(mensagemAntiga(new Date("2026-08-31T12:00:00Z"), limiteImportacao(desde, corte, null))).toBe(true);
  });
});

describe("importar do celular: 'tudo' x 'a partir de um dia'", () => {
  it("'tudo' vira o começo dos tempos — nenhuma mensagem é antiga demais", () => {
    const desde = desdeDaImportacao(DESDE_TUDO);
    expect(desde).toEqual(new Date(0));
    expect(mensagemAntiga(new Date("2015-03-01T12:00:00Z"), limiteImportacao(desde, new Date("2026-09-16T03:00:00Z"), null))).toBe(false);
  });

  it("um dia vira 00:00 de Brasília; qualquer outra coisa é 'sem escolha'", () => {
    expect(desdeDaImportacao("2026-09-01")).toEqual(new Date("2026-09-01T03:00:00Z"));
    expect(desdeDaImportacao(null)).toBeNull();
    expect(desdeDaImportacao("ontem")).toBeNull();
    expect(desdeDaImportacao(42)).toBeNull();
  });

  it("com 'tudo', conversa apagada à mão continua só voltando com mensagem posterior à exclusão", () => {
    const exclusao = new Date("2026-09-20T15:00:00Z");
    const limite = limiteImportacao(desdeDaImportacao(DESDE_TUDO), null, exclusao);
    expect(limite).toEqual(exclusao);
    expect(mensagemAntiga(new Date("2026-09-19T12:00:00Z"), limite)).toBe(true);
    expect(mensagemAntiga(new Date("2026-09-21T12:00:00Z"), limite)).toBe(false);
  });
});
