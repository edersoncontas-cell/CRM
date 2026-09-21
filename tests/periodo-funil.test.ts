// PERÍODO DO FUNIL: ano e mês.
//
// "No novo funil faça separação por período, mês e ano."
//
// O risco aqui é de FUSO, e ele só aparece nas últimas 3 horas de cada mês: o
// servidor roda em UTC e o vendedor vive em Brasília, então uma máquina
// faturada às 21h de 30/09 é 01/10 em UTC. Montando o intervalo em UTC, essa
// venda cairia em outubro dentro do relatório de setembro — e ninguém
// desconfiaria, porque o total do ano continuaria certo.

import { describe, it, expect } from "vitest";
import { intervaloDoPeriodo, rotuloPeriodo, mesDaUrl, queryDoPeriodo, MESES } from "@/lib/periodo-funil";

describe("o mês vindo da URL", () => {
  it("aceita 1 a 12", () => {
    expect(mesDaUrl("1")).toBe(1);
    expect(mesDaUrl("12")).toBe(12);
  });

  it("lixo vira ano inteiro, nunca erro", () => {
    expect(mesDaUrl("0")).toBeNull();
    expect(mesDaUrl("13")).toBeNull();
    expect(mesDaUrl("setembro")).toBeNull();
    expect(mesDaUrl(undefined)).toBeNull();
    expect(mesDaUrl("")).toBeNull();
  });
});

describe("o intervalo do período respeita o fuso de Brasília", () => {
  it("setembro começa à meia-noite DELE, que é 03:00 em UTC", () => {
    const i = intervaloDoPeriodo({ ano: 2026, mes: 9 })!;
    expect(i.gte.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(i.lt.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("a venda das 21h de 30/09 é de SETEMBRO, não de outubro", () => {
    const venda = new Date("2026-09-30T21:00:00-03:00"); // 01/10 00:00 em UTC
    const set = intervaloDoPeriodo({ ano: 2026, mes: 9 })!;
    const out = intervaloDoPeriodo({ ano: 2026, mes: 10 })!;
    expect(venda >= set.gte && venda < set.lt).toBe(true);
    expect(venda >= out.gte && venda < out.lt).toBe(false);
  });

  it("dezembro vira o ano certo", () => {
    const i = intervaloDoPeriodo({ ano: 2026, mes: 12 })!;
    expect(i.gte.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(i.lt.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("ano inteiro vai de janeiro a janeiro", () => {
    const i = intervaloDoPeriodo({ ano: 2026, mes: null })!;
    expect(i.gte.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(i.lt.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("os doze meses cobrem o ano sem buraco e sem sobreposição", () => {
    const ano = intervaloDoPeriodo({ ano: 2026, mes: null })!;
    let cursor = ano.gte.getTime();
    for (let m = 1; m <= 12; m++) {
      const i = intervaloDoPeriodo({ ano: 2026, mes: m })!;
      expect(i.gte.getTime()).toBe(cursor); // emenda exata no mês anterior
      cursor = i.lt.getTime();
    }
    expect(cursor).toBe(ano.lt.getTime());
  });

  it("todos os anos não recorta nada", () => {
    expect(intervaloDoPeriodo({ ano: "todos", mes: null })).toBeNull();
    expect(intervaloDoPeriodo({ ano: "todos", mes: 9 })).toBeNull();
  });
});

describe("como o vendedor lê o período", () => {
  it("mês e ano por extenso", () => {
    expect(rotuloPeriodo({ ano: 2026, mes: 9 })).toBe("setembro de 2026");
    expect(rotuloPeriodo({ ano: 2026, mes: null })).toBe("2026");
    expect(rotuloPeriodo({ ano: "todos", mes: null })).toBe("todo o histórico");
  });

  it("os doze meses estão escritos em português", () => {
    expect(MESES).toHaveLength(12);
    expect(MESES[2]).toBe("março");
  });
});

describe("os links carregam o recorte escolhido", () => {
  it("mês e ano viajam juntos", () => {
    expect(queryDoPeriodo({ ano: 2026, mes: 9 })).toBe("ano=2026&mes=9");
  });

  it("sem mês, só o ano", () => {
    expect(queryDoPeriodo({ ano: 2026, mes: null })).toBe("ano=2026");
  });

  it("dá para acrescentar e para tirar outro filtro", () => {
    expect(queryDoPeriodo({ ano: 2026, mes: 9 }, { motivo: "preco" })).toBe("ano=2026&mes=9&motivo=preco");
    expect(queryDoPeriodo({ ano: 2026, mes: 9 }, { motivo: null })).toBe("ano=2026&mes=9");
  });
});
