import { describe, expect, it } from "vitest";
import { variacaoDiaria, arabicaDaLeitura, VALIDADE_ARABICA_MS, type PontoHistoricoCafe } from "../src/lib/cafe-parsers";

const hist: PontoHistoricoCafe[] = [
  { data: "12/09/2026", conilon: 960, arabica: 1200, fonte: "Painel do Café" },
  { data: "14/09/2026", conilon: 970, arabica: 1210, fonte: "Painel do Café" },
  { data: "15/09/2026", conilon: 980.78, arabica: 1211.59, fonte: "Painel do Café" },
];

describe("variação diária do café", () => {
  it("compara com o último dia diferente de hoje (ignora as releituras de hoje)", () => {
    const v = variacaoDiaria(hist, "15/09/2026", "conilon", 980.78, 980.78);
    expect(v.base).toBe("dia 14/09/2026");
    expect(v.pct).toBe(1.11);
    const a = variacaoDiaria(hist, "15/09/2026", "arabica", 1205, 1211.59);
    expect(a.pct).toBe(-0.41);
  });

  it("sem dia anterior, compara com a leitura anterior", () => {
    const v = variacaoDiaria([hist[2]], "15/09/2026", "conilon", 982, 980);
    expect(v.base).toBe("leitura anterior");
    expect(v.pct).toBe(0.2);
  });

  it("primeira leitura de todas mostra 0% (a seta nunca some)", () => {
    const v = variacaoDiaria([], "15/09/2026", "arabica", 1211.59, null);
    expect(v).toEqual({ pct: 0, base: "primeira leitura" });
  });

  it("sem valor, sem variação", () => {
    expect(variacaoDiaria(hist, "15/09/2026", "arabica", null, 1200).pct).toBeNull();
  });

  it("descarta saltos absurdos (fonte trocou de unidade)", () => {
    expect(variacaoDiaria(hist, "15/09/2026", "conilon", 3000, null).pct).toBeNull();
  });
});

describe("arábica que a fonte da vez não trouxe (o 0,00% travado de 01/10)", () => {
  const agora = new Date("2026-10-01T15:00:00Z");
  const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000).toISOString();
  const histNeon: PontoHistoricoCafe[] = [{ data: "23/09/2026", conilon: 940, arabica: 1155, fonte: "CCCV (Vitória)" }];
  const semArabica = { arabica: null };

  it("o caso dele: leitura antiga sem data do arábica não é repetida — nada de 0,00%", () => {
    const anterior = { arabica: 1155, variacaoArabicaPct: 0 };
    const r = arabicaDaLeitura({ achado: semArabica, anterior, hist: histNeon, chaveHoje: "01/10/2026", agora });
    expect(r.arabica).toBeNull();
    expect(r.pct).toBeNull();
    expect(r.noHistorico).toBeNull();
  });

  it("arábica lido há pouco é repetido com a variação que tinha", () => {
    const anterior = { arabica: 1210, arabicaLidaEm: horasAtras(2), variacaoArabicaPct: 1.3 };
    const r = arabicaDaLeitura({ achado: semArabica, anterior, hist: histNeon, chaveHoje: "01/10/2026", agora });
    expect(r).toMatchObject({ arabica: 1210, pct: 1.3, lidaEm: anterior.arabicaLidaEm });
  });

  it("mais de 6 h depois de lido, para de ser repetido", () => {
    expect(VALIDADE_ARABICA_MS).toBe(6 * 3_600_000);
    const anterior = { arabica: 1210, arabicaLidaEm: horasAtras(6.1), variacaoArabicaPct: 1.3 };
    expect(arabicaDaLeitura({ achado: semArabica, anterior, hist: histNeon, chaveHoje: "01/10/2026", agora }).arabica).toBeNull();
  });

  it("data de leitura ilegível ou no futuro não vale", () => {
    for (const lidaEm of ["lixo", new Date(agora.getTime() + 3_600_000).toISOString()]) {
      const anterior = { arabica: 1210, arabicaLidaEm: lidaEm, variacaoArabicaPct: 1.3 };
      expect(arabicaDaLeitura({ achado: semArabica, anterior, hist: histNeon, chaveHoje: "01/10/2026", agora }).arabica).toBeNull();
    }
  });

  it("o repetido não entra no histórico (viraria a base de amanhã); o lido hoje cedo fica", () => {
    const anterior = { arabica: 1210, arabicaLidaEm: horasAtras(1), variacaoArabicaPct: 1.3 };
    const comHoje = [...histNeon, { data: "01/10/2026", conilon: 985, arabica: 1210, fonte: "CCCV (Vitória)" }];
    expect(arabicaDaLeitura({ achado: semArabica, anterior, hist: histNeon, chaveHoje: "01/10/2026", agora }).noHistorico).toBeNull();
    expect(arabicaDaLeitura({ achado: semArabica, anterior, hist: comHoje, chaveHoje: "01/10/2026", agora }).noHistorico).toBe(1210);
  });

  it("arábica lido agora: data de agora e variação contra o último dia diferente", () => {
    const r = arabicaDaLeitura({ achado: { arabica: 1200 }, anterior: { arabica: 1155 }, hist: histNeon, chaveHoje: "01/10/2026", agora });
    expect(r).toEqual({ arabica: 1200, lidaEm: agora.toISOString(), pct: 3.9, base: "dia 23/09/2026", noHistorico: 1200 });
  });

  it("a variação que a própria fonte informa vence a calculada", () => {
    const r = arabicaDaLeitura({ achado: { arabica: 1200, variacaoArabicaPct: -0.5 }, anterior: null, hist: histNeon, chaveHoje: "01/10/2026", agora });
    expect(r.pct).toBe(-0.5);
  });
});
