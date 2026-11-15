import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mesCorrente, escolherMetaDoMes, montarMeuMes, DIAS_PARADO, ITENS_POR_LISTA,
  type VendaEntrada, type NegociacaoEntrada,
} from "@/lib/meu-mes-regra";
import { meiaNoiteBR } from "@/lib/fuso-brasilia";

const AGORA = new Date("2026-11-15T17:00:00Z"); // 15/11/2026 14:00 em Brasília
const d = (s: string) => new Date(s);

const venda = (i: number, faturadoEm: string, extra: Partial<VendaEntrada> = {}): VendaEntrada =>
  ({ id: `v${i}`, clienteId: `c${i}`, clienteNome: `Cliente ${i}`, marca: "New Holland", modelo: "B95C", valor: 100000 * i, faturadoEm: d(faturadoEm), ...extra });
const neg = (i: number, extra: Partial<NegociacaoEntrada> = {}): NegociacaoEntrada =>
  ({ id: `n${i}`, clienteId: `c${i}`, clienteNome: `Negócio ${i}`, estagio: "PROPOSTA", valor: 1000 * i, marca: null, maquinaModelo: null, proximaAcao: null, ultimoContato: d("2026-11-14T12:00:00Z"), criadoEm: d("2026-10-01T12:00:00Z"), ...extra });

describe("mês corrente (Brasília)", () => {
  it("novembro de 2026", () => {
    const m = mesCorrente(AGORA);
    expect([m.inicio.toISOString(), m.fim.toISOString(), m.rotulo]).toEqual(["2026-11-01T03:00:00.000Z", "2026-12-01T03:00:00.000Z", "novembro de 2026"]);
  });
  it("01/12 01:00 em Brasília já é dezembro; 30/11 23:30 ainda é novembro", () => {
    expect(mesCorrente(new Date("2026-12-01T04:00:00Z")).rotulo).toBe("dezembro de 2026");
    expect(mesCorrente(new Date("2026-12-01T02:30:00Z")).rotulo).toBe("novembro de 2026");
  });
});

describe("meta do mês", () => {
  const meta = (extra: Record<string, unknown> = {}) => ({ inicio: meiaNoiteBR(2026, 10, 1), fim: meiaNoiteBR(2026, 11, 1), meta: 5, supermeta: 7, criadoEm: d("2026-11-02"), ...extra }) as Parameters<typeof escolherMetaDoMes>[0][number];
  it("usa a meta mensal que cobre hoje; a criada por último vence", () => {
    expect(escolherMetaDoMes([meta()], AGORA, 40)).toEqual({ meta: 5, supermeta: 7, origem: "metas" });
    expect(escolherMetaDoMes([meta(), meta({ meta: 9, supermeta: null, criadoEm: d("2026-11-10") })], AGORA, 40)).toEqual({ meta: 9, supermeta: null, origem: "metas" });
  });
  it("sem meta (ou de outro mês, ou inválida): meta anual de Parâmetros ÷ 12, para cima", () => {
    const fora = meta({ inicio: meiaNoiteBR(2026, 9, 1), fim: meiaNoiteBR(2026, 10, 1) });
    expect(escolherMetaDoMes([], AGORA, 40)).toEqual({ meta: 4, supermeta: null, origem: "parametros" });
    expect(escolherMetaDoMes([fora, meta({ meta: 0 })], AGORA, 40).origem).toBe("parametros");
    expect(escolherMetaDoMes([], AGORA, 24).meta).toBe(2);
  });
  it("o mês acaba exatamente no fim: a meta de novembro não vale em 01/12 00:00 BRT", () => {
    expect(escolherMetaDoMes([meta()], new Date("2026-12-01T03:00:00Z"), 40).origem).toBe("parametros");
  });
  it("Parâmetros absurdo não gera meta zero nem NaN", () => {
    for (const a of [0, -3, NaN]) expect(escolherMetaDoMes([], AGORA, a).meta).toBeGreaterThanOrEqual(1);
  });
});

describe("montarMeuMes", () => {
  const meta = { meta: 4, supermeta: 6, origem: "metas" as const };
  it("conta só as vendas do mês (fuso de Brasília) e calcula a falta", () => {
    const vendas = [
      venda(1, "2026-11-03T15:00:00Z"), venda(2, "2026-11-09T15:00:00Z"),
      venda(3, "2026-12-01T01:00:00Z"),  // 30/11 22:00 BRT: novembro
      venda(4, "2026-12-01T04:00:00Z"),  // 01/12 01:00 BRT: dezembro, fora
      venda(5, "2026-10-20T15:00:00Z"),  // outubro, fora
    ];
    const r = montarMeuMes({ agora: AGORA, vendas, negociacoes: [], meta });
    expect(r.progresso.atual).toBe(3);
    expect(r.progresso.falta).toBe(1);
    expect(r.faturadoNoMes).toBe(100000 + 200000 + 300000);
    expect(r.incentivo).toBeNull();
  });
  it("últimas 5 vendas: mais recentes primeiro, e nunca mais que 5", () => {
    const vendas = Array.from({ length: 8 }, (_, i) => venda(i + 1, `2026-0${(i % 9) + 1}-10T15:00:00Z`));
    const r = montarMeuMes({ agora: AGORA, vendas, negociacoes: [], meta });
    expect(r.ultimasVendas).toHaveLength(ITENS_POR_LISTA);
    const datas = r.ultimasVendas.map((v) => v.quando.getTime());
    expect([...datas].sort((a, b) => b - a)).toEqual(datas);
  });
  it("últimas prospecções: negociações mais novas primeiro", () => {
    const negs = [neg(1, { criadoEm: d("2026-09-01T12:00:00Z") }), neg(2, { criadoEm: d("2026-11-10T12:00:00Z") }), neg(3, { criadoEm: d("2026-10-10T12:00:00Z") })];
    expect(montarMeuMes({ agora: AGORA, vendas: [], negociacoes: negs, meta }).ultimasProspeccoes.map((p) => p.id)).toEqual(["n2", "n3", "n1"]);
  });
  it("abertos: parados primeiro (mais antigo no topo), depois os em dia por valor", () => {
    const negs = [
      neg(1, { valor: 900 }),                                                                        // em dia, caro
      neg(2, { ultimoContato: d("2026-10-20T12:00:00Z"), proximaAcao: "  Ligar amanhã  " }),         // 26 dias
      neg(3, { ultimoContato: null, criadoEm: d("2026-09-01T12:00:00Z") }),                           // nunca contatado: conta da criação (75 dias)
      neg(4, { valor: 5000 }),                                                                        // em dia, mais caro ainda
      neg(5, { ultimoContato: d("2026-11-05T12:00:00Z") }),                                           // 10 dias: parado no limite
    ];
    const r = montarMeuMes({ agora: AGORA, vendas: [], negociacoes: negs, meta });
    expect(r.abertos.map((n) => n.id)).toEqual(["n3", "n2", "n5", "n4", "n1"]);
    expect(r.abertos.find((n) => n.id === "n2")?.proximoPasso).toBe("Ligar amanhã");
    expect(r.abertos.find((n) => n.id === "n1")?.proximoPasso).toBeNull();
    expect(r.abertos[2].diasSemContato).toBe(DIAS_PARADO);
    expect(r.abertos[2].parado).toBe(true);
    expect(r.totalParados).toBe(3);
  });
  it("9 dias sem contato ainda não é parado", () => {
    const r = montarMeuMes({ agora: AGORA, vendas: [], negociacoes: [neg(1, { ultimoContato: d("2026-11-06T12:00:00Z") })], meta });
    expect(r.abertos[0]).toMatchObject({ parado: false, diasSemContato: 9 });
  });
  it("sem venda no mês: frase de incentivo com o próximo passo (e fala dos parados quando há)", () => {
    const sem = montarMeuMes({ agora: AGORA, vendas: [], negociacoes: [], meta });
    expect(sem.incentivo).toMatch(/Nenhuma venda faturada neste mês/);
    expect(sem.incentivo).toMatch(/marcar visitas/);
    expect(sem.progresso.atual).toBe(0);
    const com = montarMeuMes({ agora: AGORA, vendas: [], negociacoes: [neg(1, { ultimoContato: d("2026-10-01T12:00:00Z") })], meta });
    expect(com.incentivo).toMatch(/1 negócio parado/);
  });
  it("tudo vazio não quebra e não inventa", () => {
    const r = montarMeuMes({ agora: AGORA, vendas: [], negociacoes: [], meta });
    expect([r.ultimasVendas, r.ultimasProspeccoes, r.abertos]).toEqual([[], [], []]);
    expect(r.totalParados).toBe(0);
  });
  it("meta batida e supermeta", () => {
    const vendas = [1, 2, 3, 4, 5, 6].map((i) => venda(i, `2026-11-0${i}T15:00:00Z`));
    const r = montarMeuMes({ agora: AGORA, vendas, negociacoes: [], meta });
    expect(r.progresso).toMatchObject({ bateu: true, bateuSupermeta: true, falta: 0 });
  });
  it("máquina sem marca e modelo vira texto claro", () => {
    const r = montarMeuMes({ agora: AGORA, vendas: [venda(1, "2026-11-03T15:00:00Z", { marca: null, modelo: null })], negociacoes: [], meta });
    expect(r.ultimasVendas[0].maquina).toBe("Máquina não informada");
  });
});

describe("metaDoMes: padrão seguro (nunca derruba, nunca inventa)", () => {
  beforeEach(() => { vi.resetModules(); });
  async function carregar(getConfig: () => Promise<string | null>, db: unknown) {
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/db", () => ({ db }));
    vi.doMock("@/lib/config", () => ({ getConfig }));
    return import("@/lib/metas-cadastro");
  }
  const padrao = { meta: 4, supermeta: null, origem: "parametros" };
  it("desligado ou valor estranho: Parâmetros ÷ 12, sem consultar a tabela", async () => {
    for (const v of [null, "", "Ligado", "sim"]) {
      const findMany = vi.fn();
      const { metaDoMes } = await carregar(async () => v, { meta: { findMany } });
      await expect(metaDoMes(AGORA, 40)).resolves.toEqual(padrao);
      expect(findMany).not.toHaveBeenCalled();
      vi.resetModules();
    }
  });
  it("banco ou tabela fora do ar: Parâmetros ÷ 12", async () => {
    const a = await carregar(async () => { throw new Error("Can't reach database"); }, {});
    await expect(a.metaDoMes(AGORA, 40)).resolves.toEqual(padrao);
    vi.resetModules();
    const b = await carregar(async () => "ligado", { meta: { findMany: vi.fn().mockRejectedValue(new Error('relation "Meta" does not exist')) } });
    await expect(b.metaDoMes(AGORA, 40)).resolves.toEqual(padrao);
  });
  it("ligado com meta do mês: ela vale", async () => {
    const findMany = vi.fn().mockResolvedValue([{ inicio: meiaNoiteBR(2026, 10, 1), fim: meiaNoiteBR(2026, 11, 1), meta: 7, supermeta: 9, criadoEm: d("2026-11-01") }]);
    const { metaDoMes } = await carregar(async () => "ligado", { meta: { findMany } });
    await expect(metaDoMes(AGORA, 40)).resolves.toEqual({ meta: 7, supermeta: 9, origem: "metas" });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ periodo: "mensal", indicador: "maquinas_faturadas" });
  });
});

describe("o bloco só existe com o recurso ligado, e falha à vista", () => {
  const pagina = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");
  it("o Dashboard só monta e mostra o bloco quando metasRecursoLigado()", () => {
    expect(pagina).toContain("const comMeuMes = await metasRecursoLigado()");
    expect(pagina).toMatch(/\{comMeuMes && <MeuMes /);
    expect(pagina).toContain("meuMesErro = true");
  });
  it("venda sem valor aparece como traço, não como R$ 0", () => {
    const comp = readFileSync(join(process.cwd(), "src/components/MeuMes.tsx"), "utf8");
    expect(comp).toContain('v.valor > 0 ? formatCurrency(v.valor) : "—"');
  });
  it("o componente trata o erro com um aviso (role=alert), não some", () => {
    const comp = readFileSync(join(process.cwd(), "src/components/MeuMes.tsx"), "utf8");
    expect(comp).toMatch(/if \(erro \|\| !dados\)/);
    expect(comp).toContain('role="alert"');
  });
});
