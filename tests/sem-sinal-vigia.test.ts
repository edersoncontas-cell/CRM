// A TELA VIGIANDO AS PRÓPRIAS AÇÕES: a que gravou avisa o worker para renovar
// as cópias. Só observa — o pedido e a resposta seguem os mesmos, e nada daqui
// pode atrapalhar o CRM de gravar.

import { describe, it, expect, vi } from "vitest";
import { vigiarAcoesQueGravam } from "@/lib/sem-sinal-sincronia";

function redeFalsa(cabecalho: string | null, falha = false) {
  return vi.fn(async (_e: RequestInfo | URL, _i?: RequestInit) => {
    if (falha) throw new TypeError("Failed to fetch");
    return new Response("0:{}", { status: 200, headers: cabecalho === null ? {} : { "x-action-revalidated": cabecalho } });
  });
}

const ACAO = { method: "POST", headers: { Accept: "text/x-component", "Next-Action": "7f3a", "Next-Router-State-Tree": "%5B%5D" }, body: "[]" };

describe("vigiar as ações da tela que gravam", () => {
  it("ação que mandou refazer telas avisa; a resposta chega igual a quem pediu", async () => {
    const rede = redeFalsa("[[],1,0]");
    const alvo = { fetch: rede as unknown as typeof fetch };
    const aoGravar = vi.fn();
    vigiarAcoesQueGravam(alvo, aoGravar);
    const res = await alvo.fetch("", ACAO);
    expect(aoGravar).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe("0:{}");
    // O pedido foi o mesmo, sem tirar nem pôr.
    expect(rede).toHaveBeenCalledWith("", ACAO);
  });

  it("ação que só leu (visitas do dia, ao abrir o app), sem cabeçalho, ou pedido comum: não avisa", async () => {
    for (const [cab, init] of [
      ["[[],0,0]", ACAO], [null, ACAO], ["lixo", ACAO],
      ["[[],1,0]", { method: "GET" }], ["[[],1,0]", undefined],
    ] as [string | null, RequestInit | undefined][]) {
      const alvo = { fetch: redeFalsa(cab) as unknown as typeof fetch };
      const aoGravar = vi.fn();
      vigiarAcoesQueGravam(alvo, aoGravar);
      await alvo.fetch("/api/alertas/contagem", init);
      expect(aoGravar, `${cab} ${JSON.stringify(init)}`).not.toHaveBeenCalled();
    }
  });

  it("ação vinda como Request também conta", async () => {
    const alvo = { fetch: redeFalsa("[[],1,0]") as unknown as typeof fetch };
    const aoGravar = vi.fn();
    vigiarAcoesQueGravam(alvo, aoGravar);
    await alvo.fetch(new Request("http://crm.teste/negociacoes", { method: "POST", headers: { "Next-Action": "x" }, body: "[]" }));
    expect(aoGravar).toHaveBeenCalledTimes(1);
  });

  it("sem rede, a falha chega à tela como chegaria sem a vigia; e o aviso que quebra não derruba a ação", async () => {
    const alvo = { fetch: redeFalsa(null, true) as unknown as typeof fetch };
    vigiarAcoesQueGravam(alvo, () => {});
    await expect(alvo.fetch("", ACAO)).rejects.toThrow("Failed to fetch");

    const alvo2 = { fetch: redeFalsa("[[],1,0]") as unknown as typeof fetch };
    vigiarAcoesQueGravam(alvo2, () => { throw new Error("worker sumiu"); });
    expect((await alvo2.fetch("", ACAO)).status).toBe(200);
  });

  it("desfazer devolve o fetch original", () => {
    const original = redeFalsa(null) as unknown as typeof fetch;
    const alvo = { fetch: original };
    const desfazer = vigiarAcoesQueGravam(alvo, () => {});
    expect(alvo.fetch).not.toBe(original);
    desfazer();
    expect(alvo.fetch).toBe(original);
  });
});
