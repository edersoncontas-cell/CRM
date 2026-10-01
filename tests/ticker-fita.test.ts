// O ritmo do letreiro do rodapé, exatamente como foi pedido:
//
//   "a cada 3 cotações de algum ativo venha uma notícia, concluindo a
//    notícia, mais 3 cotações atuais de outros ativos, e assim
//    sucessivamente"
//
// A parte que pode quebrar sem ninguém ver é o "OUTROS ativos": se o rodízio
// reiniciasse a cada grupo, o letreiro mostraria o mesmo trio a vida toda e
// pareceria travado. É isso que estes testes guardam.

import { describe, it, expect } from "vitest";
import { montarFita, duracaoDaFita, cotacoesDaFita, COTACOES_POR_NOTICIA, TEXTO_FALTA, type CotacaoFita, type NoticiaFita } from "@/lib/ticker-fita";
import type { CotacoesMercado } from "@/lib/mercado";

const cot = (chave: string): CotacaoFita => ({ chave, rotulo: chave.toUpperCase(), valor: "R$ 1,00", pct: 0 });
const noticia = (t: string): NoticiaFita => ({ titulo: t, tema: "Café", fonte: "Fonte", link: "https://x" });

const SEIS = ["arabica", "conilon", "dolar", "arabicaES", "conilonES", "euro"].map(cot);

describe("o ritmo: 3 cotações, 1 notícia", () => {
  it("é isso que o vendedor pediu, em número", () => {
    expect(COTACOES_POR_NOTICIA).toBe(3);
  });

  it("intercala exatamente 3 cotações antes de cada notícia", () => {
    const f = montarFita(SEIS, [noticia("n1"), noticia("n2")]);
    expect(f.map((i) => i.tipo)).toEqual([
      "cotacao", "cotacao", "cotacao", "noticia",
      "cotacao", "cotacao", "cotacao", "noticia",
    ]);
  });

  it("o segundo grupo traz OUTROS ativos — o coração do pedido", () => {
    const f = montarFita(SEIS, [noticia("n1"), noticia("n2")]);
    const grupo1 = f.slice(0, 3).map((i) => (i.tipo === "cotacao" ? i.chave : ""));
    const grupo2 = f.slice(4, 7).map((i) => (i.tipo === "cotacao" ? i.chave : ""));
    expect(grupo1).toEqual(["arabica", "conilon", "dolar"]);
    expect(grupo2).toEqual(["arabicaES", "conilonES", "euro"]);
    // Nenhum ativo repetido entre os dois grupos.
    expect(grupo1.filter((c) => grupo2.includes(c))).toEqual([]);
  });

  it("o rodízio dá a volta e continua — nunca acaba no meio", () => {
    const f = montarFita(SEIS, [noticia("a"), noticia("b"), noticia("c")]);
    const grupo3 = f.slice(8, 11).map((i) => (i.tipo === "cotacao" ? i.chave : ""));
    expect(grupo3).toEqual(["arabica", "conilon", "dolar"]);
  });

  it("uma notícia por grupo, na ordem em que chegaram", () => {
    const f = montarFita(SEIS, [noticia("primeira"), noticia("segunda")]);
    const titulos = f.filter((i) => i.tipo === "noticia").map((i) => (i.tipo === "noticia" ? i.titulo : ""));
    expect(titulos).toEqual(["primeira", "segunda"]);
  });
});

describe("quando falta uma das fontes, o letreiro não fica vazio", () => {
  it("sem notícia, passa só cotação", () => {
    const f = montarFita(SEIS, []);
    expect(f).toHaveLength(6);
    expect(f.every((i) => i.tipo === "cotacao")).toBe(true);
  });

  it("sem cotação, passa só notícia", () => {
    const f = montarFita([], [noticia("n1"), noticia("n2")]);
    expect(f.map((i) => i.tipo)).toEqual(["noticia", "noticia"]);
  });

  it("sem nada, não inventa fita", () => {
    expect(montarFita([], [])).toEqual([]);
  });
});

describe("os limites do dado", () => {
  // "no letreiro está repetindo o valor do café conilon, antes era o dolar":
  // com dois ativos, o grupo de três repetia um deles no lugar do que faltou.
  it("com menos ativos que o grupo, o grupo encolhe — o mesmo ativo nunca duas vezes seguidas", () => {
    const f = montarFita([cot("dolar")], [noticia("n1")]);
    expect(f.map((i) => (i.tipo === "cotacao" ? i.chave : "NOT"))).toEqual(["dolar", "NOT"]);
    const dois = montarFita([cot("arabica"), cot("conilon")], [noticia("n1"), noticia("n2")]);
    expect(dois.map((i) => (i.tipo === "cotacao" ? i.chave : "NOT"))).toEqual(["arabica", "conilon", "NOT", "arabica", "conilon", "NOT"]);
  });

  it("grupo inválido não quebra a fita", () => {
    expect(montarFita(SEIS, [noticia("n")], 0).filter((i) => i.tipo === "cotacao")).toHaveLength(1);
    expect(montarFita(SEIS, [noticia("n")], -5).filter((i) => i.tipo === "cotacao")).toHaveLength(1);
  });
});

describe("a duração da passagem", () => {
  it("fita curta tem piso — senão o letreiro sai correndo", () => {
    expect(duracaoDaFita(montarFita([cot("dolar")], []))).toBeGreaterThanOrEqual(40);
  });

  it("fita longa demora mais que fita curta", () => {
    const curta = duracaoDaFita(montarFita(SEIS, [noticia("n")]));
    const longa = duracaoDaFita(montarFita(SEIS, Array.from({ length: 8 }, (_, i) => noticia(`manchete bem comprida número ${i}`))));
    expect(longa).toBeGreaterThan(curta);
  });
});

// O que vai no letreiro, a partir do que a rota devolveu.
function mercado(parcial: Partial<CotacoesMercado>): CotacoesMercado {
  return {
    dolar: null, cafeArabica: null, cafeConilon: null, cafeAtualizadoEm: null,
    detalhe: { dolar: null, arabica: null, conilon: null }, fonte: "mercado", cafeES: null, ...parcial,
  };
}
const cafeES = (extra: Record<string, unknown> = {}) => ({
  conilon: 1180.5, arabica: 1890, dataReferencia: "30/09/2026", fonte: "Painel do Café", atualizadoEm: "2026-10-01T12:00:00Z",
  variacaoConilonPct: 0.5, variacaoArabicaPct: -0.2, ...extra,
});

describe("as cotações do letreiro", () => {
  it("o dia normal: arábica e conilon do ES, dólar do Painel do Café", () => {
    const l = cotacoesDaFita(mercado({ cafeES: cafeES({ dolar: 5.31 }) }));
    expect(l.map((x) => [x.rotulo, x.valor])).toEqual([["Arábica ES", "R$ 1.890,00"], ["Conilon ES", "R$ 1.180,50"], ["Dólar", "R$ 5,31"]]);
    expect(l.some((x) => x.falta)).toBe(false);
  });

  it("o Painel sem dólar: vale o dólar da bolsa", () => {
    const l = cotacoesDaFita(mercado({ cafeES: cafeES({ dolar: null }), dolar: 5.29 }));
    expect(l[2]).toMatchObject({ rotulo: "Dólar", valor: "R$ 5,29" });
  });

  // O caso de 01/10: nenhuma fonte trouxe o dólar. Ele não pode sumir (o
  // rodízio repetia o café no lugar dele): fica, dizendo que falta.
  it("sem dólar nenhum: o lugar dele fica, dizendo que está indisponível", () => {
    const l = cotacoesDaFita(mercado({ cafeES: cafeES({ dolar: null }) }));
    expect(l).toHaveLength(3);
    expect(l[2]).toMatchObject({ chave: "dolar", rotulo: "Dólar", valor: TEXTO_FALTA, falta: true, pct: null });
    const f = montarFita(l, [noticia("n1"), noticia("n2")]);
    const conilons = f.slice(0, 3).filter((i) => i.tipo === "cotacao" && i.chave.startsWith("conilon"));
    expect(conilons).toHaveLength(1);
  });

  it("sem o café do ES: a bolsa, com o nome da praça", () => {
    const l = cotacoesDaFita(mercado({ cafeArabica: 2100, cafeConilon: 1300, dolar: 5.3 }));
    expect(l.map((x) => x.rotulo)).toEqual(["Arábica NY", "Conilon Londres", "Dólar"]);
  });

  it("nada veio: lista vazia — o letreiro passa só as notícias", () => {
    expect(cotacoesDaFita(mercado({}))).toEqual([]);
  });
});
