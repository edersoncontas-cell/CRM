// O dólar do letreiro e dos cartões do Dashboard.
//
//   "no letreiro está repetindo o valor do café conilon, antes era o dolar"
//
// O dólar vinha de uma fonte só (AwesomeAPI) e não era guardado à parte: a
// leitura da bolsa só era gravada quando o café também vinha. Fonte fora,
// dólar fora — e o rodízio do letreiro repetia o café no lugar dele. Aqui se
// prova: a reserva (Yahoo), o último dólar bom guardado, e que número fora do
// possível não entra como dólar.

import { describe, it, expect, vi, beforeEach } from "vitest";

const banco = new Map<string, string>();
vi.mock("@/lib/config", () => ({
  getConfig: async (k: string) => banco.get(k) ?? null,
  setConfig: async (k: string, v: string) => { banco.set(k, v); },
}));
vi.mock("@/lib/cafe-es", () => ({ lerCafeES: async () => null }));

import { atualizarCotacoesMercado, obterCotacoes, limparCacheCotacoes, dolarPlausivel } from "@/lib/mercado";

type Resposta = { status: number; corpo: unknown };
let rotas: Record<string, Resposta>;
const pedidos: string[] = [];

function rede(url: string): Resposta {
  for (const [trecho, r] of Object.entries(rotas)) if (url.includes(trecho)) return r;
  return { status: 503, corpo: {} };
}

beforeEach(() => {
  banco.clear();
  pedidos.length = 0;
  limparCacheCotacoes();
  rotas = {};
  vi.stubGlobal("fetch", async (url: string) => {
    pedidos.push(url);
    const r = rede(url);
    return { ok: r.status < 400, status: r.status, json: async () => r.corpo } as Response;
  });
});

const awesome = (bid: string) => ({ status: 200, corpo: { USDBRL: { bid, pctChange: "0.4" } } });
const yahoo = (preco: number, anterior = preco) => ({ status: 200, corpo: { chart: { result: [{ meta: { regularMarketPrice: preco, chartPreviousClose: anterior } }] } } });

describe("de onde vem o dólar", () => {
  it("AwesomeAPI respondendo: é ela, e o valor fica guardado", async () => {
    rotas = { awesomeapi: awesome("5.31"), "KC%3DF": yahoo(380), "RC%3DF": yahoo(4500) };
    const c = await atualizarCotacoesMercado();
    expect(c.dolar).toBe(5.31);
    expect(c.dolarFonte).toBe("AwesomeAPI");
    expect(JSON.parse(banco.get("cotacao_dolar_ultimo")!).cotacao.valor).toBe(5.31);
  });

  it("AwesomeAPI fora (401/429): o par BRL=X do Yahoo entra no lugar", async () => {
    rotas = { awesomeapi: { status: 429, corpo: {} }, "BRL%3DX": yahoo(5.27, 5.3), "KC%3DF": yahoo(380), "RC%3DF": yahoo(4500) };
    const c = await atualizarCotacoesMercado();
    expect(c.dolar).toBe(5.27);
    expect(c.dolarFonte).toBe("Yahoo Finance");
    // E o café da bolsa sai em reais com ele (antes: sem dólar, sem café).
    expect(c.cafeConilon).toBeCloseTo((4500 / 1000) * 60 * 5.27, 2);
  });

  it("nenhuma fonte agora: o último dólar bom, dizendo de quando é", async () => {
    rotas = { awesomeapi: awesome("5.31"), "KC%3DF": yahoo(380), "RC%3DF": yahoo(4500) };
    await atualizarCotacoesMercado();
    rotas = {};
    limparCacheCotacoes();
    const c = await atualizarCotacoesMercado();
    expect(c.dolar).toBe(5.31);
    expect(c.dolarFonte).toBe("AwesomeAPI");
    expect(c.dolarLidoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("número fora do possível não entra como dólar (nem o preço de uma saca)", async () => {
    expect(dolarPlausivel(5.3)).toBe(true);
    expect(dolarPlausivel(1180.5)).toBe(false);
    expect(dolarPlausivel(0)).toBe(false);
    expect(dolarPlausivel(Number.NaN)).toBe(false);
    rotas = { awesomeapi: awesome("1180.50"), "BRL%3DX": yahoo(1180.5) };
    const c = await atualizarCotacoesMercado();
    expect(c.dolar).toBeNull();
    expect(banco.has("cotacao_dolar_ultimo")).toBe(false);
  });
});

describe("a leitura das telas (obterCotacoes)", () => {
  // A bolsa só é gravada quando o café vem. Com o café da bolsa fora por dias,
  // a leitura gravada carregava um dólar velho — o guardado à parte é o novo.
  it("o dólar guardado à parte vence o dólar velho da última leitura da bolsa", async () => {
    banco.set("cotacao_auto_ultima", JSON.stringify({
      dolar: 4.9, cafeArabica: 2000, cafeConilon: 1200, cafeAtualizadoEm: "2026-09-23T10:00:00Z",
      detalhe: { dolar: { valor: 4.9, variacaoPct: 0.1, bruto: null, unidadeBruta: null }, arabica: null, conilon: null }, fonte: "mercado",
    }));
    banco.set("cotacao_dolar_ultimo", JSON.stringify({ cotacao: { valor: 5.33, variacaoPct: -0.2, bruto: null, unidadeBruta: null }, fonte: "Yahoo Finance", em: "2026-10-01T11:00:00Z" }));
    const c = await obterCotacoes();
    expect(c.dolar).toBe(5.33);
    expect(c.detalhe.dolar?.valor).toBe(5.33);
    expect(c.dolarFonte).toBe("Yahoo Finance");
    expect(c.cafeArabica).toBe(2000);
    expect(pedidos).toEqual([]); // só leu o banco
  });

  it("dólar guardado estragado não vira dólar", async () => {
    banco.set("cotacao_auto_ultima", JSON.stringify({ dolar: 5.1, cafeArabica: 2000, cafeConilon: null, cafeAtualizadoEm: null, detalhe: { dolar: null, arabica: null, conilon: null }, fonte: "mercado" }));
    banco.set("cotacao_dolar_ultimo", "{lixo");
    expect((await obterCotacoes()).dolar).toBe(5.1);
  });
});
