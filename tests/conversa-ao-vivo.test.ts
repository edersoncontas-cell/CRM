import { describe, it, expect } from "vitest";
import { aEntregar, esquecerForaDaJanela, inicioDaJanela, jaNaTela, JANELA_ATRASO_MS, type MarcaMensagem } from "../src/lib/conversa-ao-vivo";

const t0 = Date.parse("2026-10-01T18:00:00Z");
const m = (id: string, seg: number): MarcaMensagem => ({ id, sentAt: new Date(t0 + seg * 1000) });

describe("conversa aberta: mensagem que entra no banco fora de ordem", () => {
  it("o que a tela já tem ao conectar não volta", () => {
    const cursor = new Date(t0 + 10_000);
    const vistas = jaNaTela([m("a", 0), m("b", 10)], cursor);
    expect(aEntregar([m("a", 0), m("b", 10)], vistas)).toEqual([]);
  });

  it("a nova de horário mais recente é entregue (o caso de sempre)", () => {
    const vistas = jaNaTela([m("a", 0)], new Date(t0));
    expect(aEntregar([m("a", 0), m("b", 5)], vistas).map((x) => x.id)).toEqual(["b"]);
  });

  it("a que chega DEPOIS com horário ANTERIOR também é entregue — o defeito de antes", () => {
    // A tela mostra até "b" (10 s). Entra no banco "atrasada", com horário de 4 s
    // (áudio que demorou a transcrever, foto do álbum, webhook repetido).
    const vistas = jaNaTela([m("a", 0), m("b", 10)], new Date(t0 + 10_000));
    expect(aEntregar([m("a", 0), m("atrasada", 4), m("b", 10)], vistas).map((x) => x.id)).toEqual(["atrasada"]);
  });

  it("entrega em ordem de horário", () => {
    const vistas = new Map<string, number>();
    expect(aEntregar([m("c", 9), m("a", 1), m("b", 5)], vistas).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("a janela olha 15 min para trás do cursor", () => {
    expect(JANELA_ATRASO_MS).toBe(15 * 60_000);
    expect(inicioDaJanela(new Date(t0)).getTime()).toBe(t0 - JANELA_ATRASO_MS);
  });

  it("esquece só o que saiu da janela", () => {
    const vistas = new Map<string, number>([["velha", t0 - JANELA_ATRASO_MS - 1], ["borda", t0 - JANELA_ATRASO_MS], ["nova", t0 - 1000]]);
    esquecerForaDaJanela(vistas, new Date(t0));
    expect([...vistas.keys()]).toEqual(["nova"]);
  });
});
