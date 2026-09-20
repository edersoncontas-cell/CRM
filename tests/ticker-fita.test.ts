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
import { montarFita, duracaoDaFita, COTACOES_POR_NOTICIA, type CotacaoFita, type NoticiaFita } from "@/lib/ticker-fita";

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
  it("com menos ativos que o grupo, eles repetem — é limite da fonte, não da regra", () => {
    const f = montarFita([cot("dolar")], [noticia("n1")]);
    expect(f.map((i) => (i.tipo === "cotacao" ? i.chave : "NOT"))).toEqual(["dolar", "dolar", "dolar", "NOT"]);
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
