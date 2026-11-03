// A TRAVA NA TELA (03/11). Liberar exige a palavra — conferida no SERVIDOR,
// não só na tela; pausar é imediato. Falha ao gravar não pode virar "liberado".

import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmouLiberar, PALAVRA_LIBERAR } from "@/lib/whatsapp-pausa-regra";

const h = vi.hoisted(() => ({ valor: null as string | null, falhaGravar: false, gravados: [] as string[] }));
vi.mock("@/lib/config", () => ({
  getConfig: async () => h.valor,
  setConfig: async (_k: string, v: string) => { if (h.falhaGravar) throw new Error("banco fora"); h.gravados.push(v); h.valor = v; },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ registrarAudit: async () => {} }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/aniversario-automatico", () => ({ lerConfigAniversario: async () => ({ ativo: false, texto: "" }) }));
vi.mock("@/lib/parametros", () => ({ lerParametros: async () => null }));
vi.mock("@/lib/envio-guarda", async () => {
  const { LIMITES_PADRAO } = await import("@/lib/envio-limites");
  return { lerLimitesEnvio: async () => LIMITES_PADRAO };
});

import { definirPausaAction } from "@/lib/whatsapp-pausa-actions";
import { limparCachePausa } from "@/lib/whatsapp-pausa";

beforeEach(() => { h.valor = null; h.falhaGravar = false; h.gravados = []; limparCachePausa(); });

describe("a palavra", () => {
  it("só LIBERAR (sem diferença de maiúscula e espaço)", () => {
    expect(PALAVRA_LIBERAR).toBe("LIBERAR");
    expect(confirmouLiberar("LIBERAR")).toBe(true);
    expect(confirmouLiberar("  liberar ")).toBe(true);
    for (const x of ["", "LIBERA", "sim", "ok", "LIBERAR!", null, undefined]) expect(confirmouLiberar(x as string)).toBe(false);
  });
});

describe("definirPausaAction", () => {
  it("liberar SEM a palavra: recusa e não grava nada", async () => {
    const r = await definirPausaAction(false);
    expect(r.ok).toBe(false);
    expect(r.pausado).toBe(true);
    expect(h.gravados).toEqual([]);
  });

  it("liberar com palavra errada: recusa", async () => {
    const r = await definirPausaAction(false, "sim");
    expect(r.ok).toBe(false);
    expect(h.gravados).toEqual([]);
  });

  it("liberar com LIBERAR: grava 'liberado'", async () => {
    const r = await definirPausaAction(false, "liberar");
    expect(r).toMatchObject({ ok: true, pausado: false });
    expect(h.gravados).toEqual(["liberado"]);
  });

  it("pausar não pede nada", async () => {
    h.valor = "liberado";
    const r = await definirPausaAction(true);
    expect(r).toMatchObject({ ok: true, pausado: true });
    expect(h.gravados).toEqual(["pausado"]);
  });

  it("banco fora ao liberar: diz que falhou e continua pausado", async () => {
    h.falhaGravar = true;
    const r = await definirPausaAction(false, "LIBERAR");
    expect(r.ok).toBe(false);
    expect(r.pausado).toBe(true);
    expect(r.erro).toMatch(/Nada mudou/);
  });
});
