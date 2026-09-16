import { describe, it, expect } from "vitest";
import { limiteMensagens, mensagemAntiga, inicioDoDiaBrasilia, diaBrasiliaISO } from "../src/lib/whatsapp-corte-regra";

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
