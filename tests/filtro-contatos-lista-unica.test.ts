// "Em Contatos que não são clientes, deixe um card, remova esse card pedaços
//  de palavras" (01/10). A lista de pedaços sumiu da tela; o que estava
// gravado nela não pode sumir do filtro sem aviso, nem voltar depois de ele
// remover.
import { describe, it, expect, vi, beforeEach } from "vitest";

const banco = new Map<string, string>();
vi.mock("@/lib/config", () => ({
  getConfig: async (k: string) => banco.get(k) ?? null,
  setConfig: async (k: string, v: string) => { banco.set(k, v); },
}));

async function modulo() {
  vi.resetModules(); // o cache de 30 s é por módulo
  return import("@/lib/filtro-contatos");
}

beforeEach(() => banco.clear());

describe("filtro de contatos: uma lista só, de palavras inteiras", () => {
  it("banco novo: a lista de fábrica, só palavras inteiras", async () => {
    const { listarFiltroContatos, motivoBloqueio } = await modulo();
    const { palavras } = await listarFiltroContatos();
    expect(palavras).toContain("contabilidade");
    expect(palavras).not.toContain("contab");
    expect(await motivoBloqueio("Contabilidade Silva")).toBe("contabilidade");
    expect(await motivoBloqueio("Bancorbrás Terraplenagem")).toBeNull();
  });

  it("o caso dele: 'financeiro' estava nos pedaços e já estava nas palavras — fica uma vez só", async () => {
    banco.set("filtro.contatos.palavras", JSON.stringify(["banco", "financeiro", "new holland"]));
    banco.set("filtro.contatos.termos", JSON.stringify(["financeiro"]));
    const { listarFiltroContatos } = await modulo();
    expect((await listarFiltroContatos()).palavras).toEqual(["banco", "financeiro", "new holland"]);
  });

  it("pedaço antigo passa a valer como palavra inteira — o filtro só estreita, nunca alarga", async () => {
    banco.set("filtro.contatos.palavras", JSON.stringify(["banco"]));
    banco.set("filtro.contatos.termos", JSON.stringify(["cartorio", "contab"]));
    const { motivoBloqueio } = await modulo();
    expect(await motivoBloqueio("Cartório de Alegre")).toBe("cartorio");
    // "contab" pegava "Contabilidade X" como pedaço; como palavra inteira, não pega mais nada.
    expect(await motivoBloqueio("Contabilidade X")).toBeNull();
  });

  it("removeu a palavra que veio dos pedaços: não volta", async () => {
    banco.set("filtro.contatos.palavras", JSON.stringify(["banco"]));
    banco.set("filtro.contatos.termos", JSON.stringify(["cartorio"]));
    let m = await modulo();
    expect((await m.removerPalavraFiltro("cartorio")).palavras).toEqual(["banco"]);
    expect(banco.get("filtro.contatos.termos")).toBe("[]");
    m = await modulo();
    expect((await m.listarFiltroContatos()).palavras).toEqual(["banco"]);
  });

  it("adicionar grava na lista de palavras, minúsculo e sem repetir", async () => {
    banco.set("filtro.contatos.palavras", JSON.stringify(["banco"]));
    const m = await modulo();
    await m.adicionarPalavraFiltro("  Despachante ");
    await m.adicionarPalavraFiltro("despachante");
    expect(JSON.parse(banco.get("filtro.contatos.palavras")!)).toEqual(["banco", "despachante"]);
  });

  it("valor gravado estragado não derruba quem consulta: vale a lista de fábrica", async () => {
    banco.set("filtro.contatos.palavras", "{quebrado");
    banco.set("filtro.contatos.termos", "nem json");
    const { listarFiltroContatos } = await modulo();
    expect((await listarFiltroContatos()).palavras).toContain("banco");
  });
});
