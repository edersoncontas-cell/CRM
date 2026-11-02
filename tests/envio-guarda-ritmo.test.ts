// O RITMO GRAVADO NO BANCO — o padrão que não machuca (CLAUDE.md, regra 3).
//
// Sem configuração, com o banco fora do ar e com valor inválido, o ritmo tem
// que cair no lado seguro: o padrão de 5/h, ou ZERO (nada sai) — nunca "sem
// limite".

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ valor: null as string | null, falha: false }));
vi.mock("@/lib/config", () => ({
  getConfig: async () => { if (h.falha) throw new Error("banco fora"); return h.valor; },
  setConfig: async () => {},
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/whatsapp-routing", () => ({ phoneLookupVariants: () => [] }));

import { lerLimitesEnvio, enviosDaUltimaHora } from "@/lib/envio-guarda";

describe("lerLimitesEnvio — porHora", () => {
  beforeEach(() => { h.valor = null; h.falha = false; });

  it("sem configuração: 5 por hora", async () => {
    expect((await lerLimitesEnvio()).porHora).toBe(5);
  });

  it("banco fora do ar: 5 por hora", async () => {
    h.falha = true;
    expect((await lerLimitesEnvio()).porHora).toBe(5);
  });

  it("gravado antes de o ritmo existir (sem o campo): 5 por hora, não 'sem limite'", async () => {
    h.valor = JSON.stringify({ tetoDiario: 80, horaInicio: 8, horaFim: 18 });
    expect((await lerLimitesEnvio()).porHora).toBe(5);
  });

  it("JSON quebrado: 5 por hora", async () => {
    h.valor = "{porHora: 99";
    expect((await lerLimitesEnvio()).porHora).toBe(5);
  });

  it("texto no lugar do número: 5 por hora", async () => {
    h.valor = JSON.stringify({ porHora: "muito" });
    expect((await lerLimitesEnvio()).porHora).toBe(5);
  });

  it("negativo vira zero (nada sai), fração arredonda para baixo", async () => {
    h.valor = JSON.stringify({ porHora: -4 });
    expect((await lerLimitesEnvio()).porHora).toBe(0);
    h.valor = JSON.stringify({ porHora: 3.9 });
    expect((await lerLimitesEnvio()).porHora).toBe(3);
  });

  it("o valor gravado vale", async () => {
    h.valor = JSON.stringify({ porHora: 10 });
    expect((await lerLimitesEnvio()).porHora).toBe(10);
  });
});

describe("enviosDaUltimaHora", () => {
  it("banco fora: devolve null (quem chama não manda)", async () => {
    expect(await enviosDaUltimaHora()).toBeNull();
  });
});
