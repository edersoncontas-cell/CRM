import { describe, expect, it } from "vitest";
import { recentesPrimeiro, type Noticia } from "../src/lib/noticias";

const agora = Date.parse("2026-09-15T12:00:00Z");
const h = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();
const n = (titulo: string, publicadoEm: string | null): Noticia => ({ titulo, link: "https://x", fonte: null, tema: "Café", publicadoEm });

describe("notícias: só de hoje e de até 2 dias, mais recentes primeiro", () => {
  it("ordena da mais nova para a mais velha", () => {
    const r = recentesPrimeiro([n("30h", h(30)), n("1h", h(1)), n("10h", h(10))], agora);
    expect(r.map((x) => x.titulo)).toEqual(["1h", "10h", "30h"]);
  });

  it("descarta o que tem mais de 2 dias ou não tem data", () => {
    const r = recentesPrimeiro([n("47h", h(47)), n("49h", h(49)), n("5 dias", h(120)), n("sem data", null)], agora);
    expect(r.map((x) => x.titulo)).toEqual(["47h"]);
  });

  it("descarta data no futuro (relógio errado da fonte)", () => {
    expect(recentesPrimeiro([n("amanhã", h(-30))], agora)).toEqual([]);
  });
});
