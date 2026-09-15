import { describe, expect, it } from "vitest";
import { variacaoDiaria, type PontoHistoricoCafe } from "../src/lib/cafe-parsers";

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
