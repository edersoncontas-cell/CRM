// A TRAVA GERAL DE ENVIO.
//
// Escrito depois do SEGUNDO bloqueio do número do vendedor. A propriedade que
// estes testes protegem é uma só, e é a mais importante do arquivo: quando não
// se sabe, é PAUSADO. Foi a ausência de resposta virar "pode mandar" que
// derrubou o número duas vezes.

import { describe, it, expect, vi, beforeEach } from "vitest";

const getConfigMock = vi.fn();
vi.mock("@/lib/config", () => ({
  getConfig: (...a: unknown[]) => getConfigMock(...a),
  setConfig: vi.fn(),
}));

import { envioPausado, limparCachePausa, exigirEnvioLiberado, EnvioPausadoError } from "@/lib/whatsapp-pausa";

beforeEach(() => { limparCachePausa(); getConfigMock.mockReset(); });

describe("padrão seguro", () => {
  it("sem configuração nenhuma, está PAUSADO", async () => {
    getConfigMock.mockResolvedValue(null);
    expect(await envioPausado()).toBe(true);
  });

  it("banco fora do ar deixa PAUSADO — nunca o contrário", async () => {
    getConfigMock.mockRejectedValue(new Error("sem banco"));
    expect(await envioPausado()).toBe(true);
  });

  it("valor estranho no banco deixa PAUSADO", async () => {
    for (const v of ["", "on", "sim", "true", "ok", "LIBERADO", "pausado"]) {
      limparCachePausa();
      getConfigMock.mockResolvedValue(v);
      expect(await envioPausado(), `valor ${JSON.stringify(v)}`).toBe(true);
    }
  });

  it("só a palavra exata 'liberado' libera", async () => {
    getConfigMock.mockResolvedValue("liberado");
    expect(await envioPausado()).toBe(false);
  });
});

describe("exigirEnvioLiberado", () => {
  it("levanta quando pausado", async () => {
    getConfigMock.mockResolvedValue(null);
    await expect(exigirEnvioLiberado()).rejects.toBeInstanceOf(EnvioPausadoError);
  });
  it("passa quando liberado", async () => {
    getConfigMock.mockResolvedValue("liberado");
    await expect(exigirEnvioLiberado()).resolves.toBeUndefined();
  });
});
