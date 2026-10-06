// Comissões Futuras (06/10, print dele): a tela só listava CRD PME e dava
// "0 negociações · R$ 0" enquanto havia vendas faturadas com a comissão
// pendente. Agora é toda faturada sem "mês pago", de qualquer forma de
// pagamento; o CRD PME continua com a previsão dos 75%.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { comissoesFuturas, comissaoPendente, previsaoComissaoCrdPme, situacaoComissao, type NegociacaoComissao } from "@/lib/comissoes-futuras";

const HOJE = new Date("2026-10-06T12:00:00-03:00");
const neg = (x: Partial<NegociacaoComissao> & { id: string }) => ({
  status: "ganha", comissaoPaga: false, tipoPagamento: "avista", valor: 500_000, faturadoEm: new Date("2026-09-10T12:00:00-03:00"), ...x,
});

describe("quem entra nas comissões futuras", () => {
  const lista = comissoesFuturas([
    neg({ id: "vista" }),
    neg({ id: "financ", tipoPagamento: "financiamento", faturadoEm: new Date("2026-08-01T12:00:00-03:00") }),
    neg({ id: "consorcio", tipoPagamento: "consorcio" }),
    neg({ id: "sem-tipo", tipoPagamento: null }),
    neg({ id: "paga", comissaoPaga: true }),
    neg({ id: "aberta", status: "aberta" }),
    neg({ id: "perdida", status: "perdida" }),
  ], 0.005, HOJE);

  it("toda faturada com a comissão pendente, de qualquer forma de pagamento", () => {
    expect(lista.map((l) => l.id).sort()).toEqual(["consorcio", "financ", "sem-tipo", "vista"]);
  });
  it("comissão paga, negociação aberta ou perdida não entram", () => {
    expect(comissaoPendente({ status: "ganha", comissaoPaga: true })).toBe(false);
    expect(comissaoPendente({ status: "aberta", comissaoPaga: false })).toBe(false);
    expect(comissaoPendente({ status: "ganha", comissaoPaga: false })).toBe(true);
  });
  it("calcula a comissão pela taxa e põe a mais antiga primeiro", () => {
    expect(lista[0].id).toBe("financ");
    expect(lista[0].comissao).toBe(2_500);
  });
  it("venda antiga sem data de faturamento entra, pela última atualização", () => {
    const [l] = comissoesFuturas([neg({ id: "antiga", faturadoEm: null, atualizadoEm: new Date("2025-03-01T12:00:00-03:00") })], 0.005, HOJE);
    expect(l.situacao).toMatchObject({ tipo: "aguardando" });
    expect((l.situacao as { diasPendente: number }).diasPendente).toBeGreaterThan(500);
  });
  it("sem nada pendente, a lista é vazia (a tela diz que está tudo pago)", () => {
    expect(comissoesFuturas([neg({ id: "p", comissaoPaga: true })], 0.005, HOJE)).toEqual([]);
  });
});

describe("CRD PME continua com a previsão dos 75%", () => {
  const crd = { faturadoEm: new Date("2026-09-10T12:00:00-03:00"), valor: 400_000, entradaValor: 100_000, crdSaldoParcelasQtd: 10, crdParcelaValor: 30_000 };
  it("entrada de 100 mil + 7 parcelas de 30 mil passam dos 75% (300 mil)", () => {
    const p = previsaoComissaoCrdPme(crd);
    expect(p.meses).toBe(7);
    expect(p.data?.getMonth()).toBe(3); // set + 7 meses = abril
  });
  it("antes da data, 'aguarda 75%'; depois, já pode cobrar", () => {
    expect(situacaoComissao({ ...crd, status: "ganha", comissaoPaga: false, tipoPagamento: "crd_pme" }, HOJE)).toMatchObject({ tipo: "crd_aguarda_75", meses: 7 });
    expect(situacaoComissao({ ...crd, status: "ganha", comissaoPaga: false, tipoPagamento: "crd_pme" }, new Date("2027-05-01"))).toMatchObject({ tipo: "crd_75_atingido" });
  });
  it("CRD PME sem valor não inventa data", () => {
    expect(situacaoComissao({ ...crd, valor: null, status: "ganha", comissaoPaga: false, tipoPagamento: "crd_pme" }, HOJE)).toEqual({ tipo: "crd_sem_dados" });
  });
});

describe("as telas usam a regra única", () => {
  const tela = readFileSync("src/app/(app)/financeiro/comissoes-futuras/page.tsx", "utf8");
  const financeiro = readFileSync("src/app/(app)/financeiro/page.tsx", "utf8");
  it("a relação não filtra mais só CRD PME e não tem mais o card da regra", () => {
    expect(tela).not.toMatch(/tipoPagamento:\s*"crd_pme"/);
    expect(tela).not.toMatch(/Regra CRD PME/);
    expect(tela).toMatch(/comissoesFuturas\(/);
  });
  it("o card e o painel do Financeiro contam a mesma coisa", () => {
    expect(financeiro).not.toMatch(/negCrdPme/);
    expect(financeiro).not.toMatch(/Comissões Futuras \(CRD PME\)/);
    expect(financeiro).toMatch(/listarComissoesFuturas\(/);
  });
  it("marcar a comissão como paga atualiza a relação", () => {
    const acoes = readFileSync("src/lib/actions.ts", "utf8");
    expect(acoes.match(/revalidatePath\("\/financeiro\/comissoes-futuras"\)/g)?.length).toBe(2);
  });
});
