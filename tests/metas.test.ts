import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  metasLigado, intervaloDoPeriodo, mesInicialSugerido, validarMeta, calcularProgresso, metasDeExemplo,
  metaAnualEfetiva, rotuloDoIntervalo, valorDoIndicador, INDICADORES, PERIODOS_META,
} from "@/lib/metas-regra";
import { meiaNoiteBR } from "@/lib/fuso-brasilia";
import { TABELAS_QUE_NAO_VEM } from "@/lib/trazer-provisorio";
import { TELAS_SEM_COPIA } from "@/lib/sem-sinal-telas";

const iso = (d: Date) => d.toISOString();
const AGORA = new Date("2026-11-15T17:00:00Z"); // 15/11/2026 14:00 em Brasília
const base = { periodo: "mensal", mes: "2026-11", indicador: "maquinas_faturadas", meta: 8, supermeta: 10 };

describe("trava do recurso: nasce desligado", () => {
  it("só a palavra exata 'ligado' liga", () => {
    expect(metasLigado("ligado")).toBe(true);
    for (const v of [undefined, null, "", "Ligado", "ligado ", "on", "1", "true", true, 1, {}]) expect(metasLigado(v), String(v)).toBe(false);
  });
});

describe("períodos em horário de Brasília", () => {
  it("mensal, trimestral, semestral e anual", () => {
    const m = intervaloDoPeriodo("mensal", "2026-11")!;
    expect([iso(m.inicio), iso(m.fim)]).toEqual(["2026-11-01T03:00:00.000Z", "2026-12-01T03:00:00.000Z"]);
    expect(iso(intervaloDoPeriodo("trimestral", "2026-11")!.fim)).toBe("2027-02-01T03:00:00.000Z"); // vira o ano
    expect(iso(intervaloDoPeriodo("semestral", "2026-07")!.fim)).toBe("2027-01-01T03:00:00.000Z");
    expect(iso(intervaloDoPeriodo("anual", "2026-01")!.fim)).toBe("2027-01-01T03:00:00.000Z");
    expect(iso(intervaloDoPeriodo("bimestral", "2026-12")!.fim)).toBe("2027-02-01T03:00:00.000Z");
  });
  it("mês inválido é recusado", () => {
    for (const x of ["", "2026-13", "2026-00", "26-11", "2026-1", "1999-05", null, undefined, "2026-11-01"]) {
      expect(intervaloDoPeriodo("mensal", x as string), String(x)).toBeNull();
    }
  });
  it("mês sugerido: o período natural que contém hoje", () => {
    expect(mesInicialSugerido("mensal", AGORA)).toBe("2026-11");
    expect(mesInicialSugerido("trimestral", AGORA)).toBe("2026-10");
    expect(mesInicialSugerido("semestral", AGORA)).toBe("2026-07");
    expect(mesInicialSugerido("anual", AGORA)).toBe("2026-01");
    expect(mesInicialSugerido("bimestral", AGORA)).toBe("2026-11");
    // 01/12 01:00 em Brasília ainda é dezembro, mas 30/11 23:30 BRT é novembro
    expect(mesInicialSugerido("mensal", new Date("2026-12-01T02:30:00Z"))).toBe("2026-11");
  });
  it("rótulo: o fim é exclusivo", () => {
    const i = intervaloDoPeriodo("mensal", "2026-11")!;
    expect(rotuloDoIntervalo(i.inicio, i.fim)).toBe("novembro de 2026");
    const t = intervaloDoPeriodo("trimestral", "2026-11")!;
    expect(rotuloDoIntervalo(t.inicio, t.fim)).toBe("nov/2026 a jan/2027");
  });
});

describe("validarMeta", () => {
  const erro = (e: Record<string, unknown>) => { const v = validarMeta({ ...base, ...e }); return v.ok ? null : v.erro; };
  it("meta válida calcula o intervalo no servidor", () => {
    const v = validarMeta(base);
    expect(v.ok).toBe(true);
    if (v.ok) expect([iso(v.valor.inicio), iso(v.valor.fim)]).toEqual(["2026-11-01T03:00:00.000Z", "2026-12-01T03:00:00.000Z"]);
  });
  it("recusa com a razão", () => {
    expect(erro({ periodo: "decenal" })).toMatch(/Período/);
    expect(erro({ indicador: "lucro" })).toMatch(/mede/);
    expect(erro({ mes: "novembro" })).toMatch(/mês/);
    expect(erro({ meta: "" })).toMatch(/número da meta/);
    expect(erro({ meta: "abc" })).toMatch(/número da meta/);
    expect(erro({ meta: 0 })).toMatch(/maior que zero/);
    expect(erro({ meta: -3 })).toMatch(/maior que zero/);
    expect(erro({ meta: 2e9 })).toMatch(/grande demais/);
    expect(erro({ meta: 2.5 })).toMatch(/inteiro/);
    expect(erro({ supermeta: 8 })).toMatch(/maior que a meta/);
    expect(erro({ supermeta: 5 })).toMatch(/maior que a meta/);
    expect(erro({ supermeta: "x" })).toMatch(/supermeta/);
    expect(erro({ supermeta: 10.5 })).toMatch(/inteiro/);
    expect(erro({ recompensa: "a".repeat(121) })).toMatch(/120/);
    expect(erro({ recompensa: "viagem", valorRecompensa: -1 })).toMatch(/valor/);
  });
  it("faturamento aceita decimal e vírgula; sem supermeta é opcional", () => {
    const v = validarMeta({ ...base, indicador: "faturamento", meta: "1500000,50", supermeta: "" });
    expect(v.ok && v.valor.meta).toBe(1500000.5);
    expect(v.ok && v.valor.supermeta).toBeNull();
  });
  it("valor de recompensa sem texto de recompensa é descartado", () => {
    const v = validarMeta({ ...base, recompensa: "", valorRecompensa: 500 });
    expect(v.ok && v.valor.valorRecompensa).toBeNull();
  });
  it("todos os indicadores e períodos passam", () => {
    for (const indicador of INDICADORES) for (const periodo of PERIODOS_META) expect(validarMeta({ ...base, indicador, periodo }).ok, `${indicador}/${periodo}`).toBe(true);
  });
});

describe("progresso", () => {
  const m = { inicio: meiaNoiteBR(2026, 10, 1), fim: meiaNoiteBR(2026, 11, 1), meta: 8, supermeta: 10 as number | null };
  it("em andamento: percentual, falta, dias, ritmo necessário", () => {
    const p = calcularProgresso(m, 3, AGORA);
    expect(p.fase).toBe("em_andamento");
    expect(p.pct).toBeCloseTo(0.375);
    expect(p.falta).toBe(5);
    expect(p.faltaSupermeta).toBe(7);
    expect(p.diasRestantes).toBe(16); // 15/11 14h BRT até 01/12 00h BRT
    expect(p.porSemanaNecessario).toBeCloseTo(5 / (16 / 7));
    expect(p.bateu).toBe(false);
  });
  it("bateu a meta e a supermeta", () => {
    expect(calcularProgresso(m, 8, AGORA)).toMatchObject({ bateu: true, bateuSupermeta: false, falta: 0, porSemanaNecessario: null });
    expect(calcularProgresso(m, 11, AGORA)).toMatchObject({ bateu: true, bateuSupermeta: true });
    expect(calcularProgresso({ ...m, supermeta: null }, 99, AGORA)).toMatchObject({ bateuSupermeta: false, pctSupermeta: null, faltaSupermeta: null });
  });
  it("futura e encerrada não têm ritmo nem dias", () => {
    const fut = calcularProgresso(m, 0, new Date("2026-10-20T12:00:00Z"));
    expect(fut).toMatchObject({ fase: "futura", diasRestantes: 0, ritmo: null, porSemanaNecessario: null });
    const enc = calcularProgresso(m, 5, new Date("2026-12-01T03:00:00Z")); // exatamente o fim: já encerrou
    expect(enc).toMatchObject({ fase: "encerrada", diasRestantes: 0, ritmo: null, bateu: false });
  });
  it("ritmo: adiantado, no ritmo, atrasado (metade do mês, esperado 4)", () => {
    const meio = new Date("2026-11-16T03:00:00Z"); // 15 de 30 dias
    expect(calcularProgresso(m, 5, meio).ritmo).toBe("adiantado");
    expect(calcularProgresso(m, 4, meio).ritmo).toBe("no_ritmo");
    expect(calcularProgresso(m, 3, meio).ritmo).toBe("atrasado");
  });
  it("sem nada feito no primeiro instante não acusa atraso", () => {
    expect(calcularProgresso(m, 0, m.inicio).ritmo).toBe("no_ritmo");
  });
  it("valores formatados", () => {
    expect(valorDoIndicador("maquinas_faturadas", 7)).toBe("7");
    expect(valorDoIndicador("faturamento", 1500000)).toContain("1.500.000");
  });
});

describe("metas de exemplo", () => {
  it("partem da meta anual de Parâmetros e a supermeta é maior que a meta", () => {
    const ex = metasDeExemplo(AGORA, 24);
    expect(ex.map((e) => [e.periodo, e.meta])).toEqual([["mensal", 2], ["trimestral", 6], ["semestral", 12], ["anual", 24]]);
    for (const e of ex) {
      expect(e.supermeta!).toBeGreaterThan(e.meta);
      expect(e.indicador).toBe("maquinas_faturadas");
      expect(e.fim.getTime()).toBeGreaterThan(e.inicio.getTime());
      // todos contêm hoje
      expect(AGORA.getTime() >= e.inicio.getTime() && AGORA.getTime() < e.fim.getTime(), e.periodo).toBe(true);
      expect(validarMeta({ ...e }).ok, e.periodo).toBe(true);
    }
  });
  it("meta anual absurda de Parâmetros não gera meta inválida", () => {
    for (const a of [0, -5, NaN, 1]) for (const e of metasDeExemplo(AGORA, a)) expect(validarMeta({ ...e }).ok).toBe(true);
  });
});

describe("meta anual efetiva (Metas vence Parâmetros)", () => {
  const ano = (a: number) => ({ inicio: meiaNoiteBR(a, 0, 1), fim: meiaNoiteBR(a + 1, 0, 1) });
  const meta = (extra: Record<string, unknown>) => ({ periodo: "anual", indicador: "maquinas_faturadas", ...ano(2026), meta: 30, criadoEm: new Date("2026-01-10"), ...extra }) as Parameters<typeof metaAnualEfetiva>[1][number];
  it("usa a meta anual do ano; sem ela, Parâmetros", () => {
    expect(metaAnualEfetiva(2026, [meta({})], 24)).toEqual({ valor: 30, origem: "metas" });
    expect(metaAnualEfetiva(2026, [], 24)).toEqual({ valor: 24, origem: "parametros" });
  });
  it("ignora outro ano, outro indicador, outro período, intervalo que não é o ano inteiro e valor inválido", () => {
    const outras = [meta(ano(2025)), meta({ indicador: "visitas" }), meta({ periodo: "semestral" }), meta({ fim: meiaNoiteBR(2026, 11, 1) }), meta({ meta: 0 })];
    expect(metaAnualEfetiva(2026, outras, 24)).toEqual({ valor: 24, origem: "parametros" });
  });
  it("com duas, vale a criada por último", () => {
    const v = metaAnualEfetiva(2026, [meta({ meta: 30 }), meta({ meta: 36, criadoEm: new Date("2026-06-01") })], 24);
    expect(v.valor).toBe(36);
  });
});

describe("padrão seguro: metaAnualDoAno nunca derruba e nunca inventa", () => {
  beforeEach(() => { vi.resetModules(); });
  async function carregar(getConfig: () => Promise<string | null>, db: unknown) {
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/db", () => ({ db }));
    vi.doMock("@/lib/config", () => ({ getConfig }));
    return import("@/lib/metas-cadastro");
  }
  it("recurso desligado ou valor estranho: Parâmetros, sem nem consultar a tabela", async () => {
    for (const v of [null, "", "desligado", "Ligado", "sim"]) {
      const findMany = vi.fn();
      const { metaAnualDoAno } = await carregar(async () => v, { meta: { findMany } });
      await expect(metaAnualDoAno(2026, 24)).resolves.toEqual({ valor: 24, origem: "parametros" });
      expect(findMany).not.toHaveBeenCalled();
      vi.resetModules();
    }
  });
  it("banco fora do ar (config ou tabela): Parâmetros", async () => {
    const a = await carregar(async () => { throw new Error("Can't reach database"); }, {});
    await expect(a.metaAnualDoAno(2026, 24)).resolves.toEqual({ valor: 24, origem: "parametros" });
    vi.resetModules();
    const b = await carregar(async () => "ligado", { meta: { findMany: vi.fn().mockRejectedValue(new Error('relation "Meta" does not exist')) } });
    await expect(b.metaAnualDoAno(2026, 24)).resolves.toEqual({ valor: 24, origem: "parametros" });
  });
  it("ligado com meta anual cadastrada: ela vale", async () => {
    const findMany = vi.fn().mockResolvedValue([{ periodo: "anual", indicador: "maquinas_faturadas", inicio: meiaNoiteBR(2026, 0, 1), fim: meiaNoiteBR(2027, 0, 1), meta: 40, criadoEm: new Date() }]);
    const { metaAnualDoAno } = await carregar(async () => "ligado", { meta: { findMany } });
    await expect(metaAnualDoAno(2026, 24)).resolves.toEqual({ valor: 40, origem: "metas" });
  });
});

describe("progresso lê o banco com as MESMAS definições de lib/metas.ts", () => {
  beforeEach(() => { vi.resetModules(); });
  it("máquinas = ganha + faturadoEm no período; visitas = realizada; negociações novas = criadoEm; faturamento = soma", async () => {
    const inicio = meiaNoiteBR(2026, 10, 1), fim = meiaNoiteBR(2026, 11, 1);
    const linha = (indicador: string) => ({ id: indicador, periodo: "mensal", indicador, inicio, fim, meta: 8, supermeta: null, exemplo: false, recompensa: null });
    const count = vi.fn().mockResolvedValue(3);
    const visitaCount = vi.fn().mockResolvedValue(7);
    const aggregate = vi.fn().mockResolvedValue({ _sum: { valor: 900000 } });
    const db = {
      meta: { findMany: vi.fn().mockResolvedValue(["maquinas_faturadas", "faturamento", "visitas", "negociacoes_novas"].map(linha)) },
      negociacao: { count, aggregate }, visita: { count: visitaCount },
    };
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/db", () => ({ db }));
    vi.doMock("@/lib/config", () => ({ getConfig: async () => "ligado" }));
    const { listarMetasComProgresso } = await import("@/lib/metas-cadastro");
    const r = await listarMetasComProgresso(AGORA);
    expect(r.map((x) => x.progresso.atual)).toEqual([3, 900000, 7, 3]);
    expect(count.mock.calls[0][0].where).toEqual({ status: "ganha", faturadoEm: { gte: inicio, lt: fim } });
    expect(aggregate.mock.calls[0][0].where).toEqual({ status: "ganha", faturadoEm: { gte: inicio, lt: fim } });
    expect(visitaCount.mock.calls[0][0].where).toEqual({ status: "realizada", data: { gte: inicio, lt: fim } });
    expect(count.mock.calls[1][0].where).toEqual({ criadoEm: { gte: inicio, lt: fim } });
  });
  it("banco fora do ar: o erro SOBE (a tela diz que falhou, não mostra lista vazia)", async () => {
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/db", () => ({ db: { meta: { findMany: vi.fn().mockRejectedValue(new Error("Can't reach database")) } } }));
    vi.doMock("@/lib/config", () => ({ getConfig: async () => "ligado" }));
    const { listarMetasComProgresso } = await import("@/lib/metas-cadastro");
    await expect(listarMetasComProgresso(AGORA)).rejects.toThrow(/database/);
  });
  it("metas de exemplo não duplicam: já existe meta, não cria nenhuma", async () => {
    const create = vi.fn();
    const tx = { meta: { count: vi.fn().mockResolvedValue(2), create } };
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/db", () => ({ db: { $transaction: async (f: (t: typeof tx) => unknown) => f(tx) } }));
    vi.doMock("@/lib/config", () => ({ getConfig: async () => "ligado" }));
    const { criarMetasDeExemplo } = await import("@/lib/metas-cadastro");
    await expect(criarMetasDeExemplo(AGORA, 24)).resolves.toEqual({ criadas: 0 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("o que mais depende da meta anual", () => {
  const raiz = join(process.cwd(), "src");
  const arquivos = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
  it("só os arquivos esperados leem metaAnualVendas direto de Parâmetros", () => {
    const permitidos = [
      "lib/parametros.ts", "lib/parametros-actions.ts", "components/ParametrosNegocioForm.tsx",
      "lib/metas.ts", "lib/metas-actions.ts", "app/(app)/dashboard/page.tsx", "app/(app)/configuracoes/page.tsx",
    ];
    const achados = arquivos(raiz).filter((f) => /metaAnualVendas/.test(readFileSync(f, "utf8"))).map((f) => f.slice(raiz.length + 1));
    expect(achados.filter((f) => !permitidos.includes(f))).toEqual([]);
  });
  it("o ritmo anual e o dashboard passam por metaAnualDoAno", () => {
    for (const f of ["src/lib/metas.ts", "src/app/(app)/dashboard/page.tsx", "src/app/(app)/configuracoes/page.tsx"]) {
      expect(readFileSync(join(process.cwd(), f), "utf8"), f).toContain("metaAnualDoAno(");
    }
  });
});

describe("decisões registradas", () => {
  it("Meta e Recompensa não vêm do banco provisório; /metas é tela ao vivo (sem cópia)", () => {
    expect(TABELAS_QUE_NAO_VEM).toContain("Meta");
    expect(TABELAS_QUE_NAO_VEM).toContain("Recompensa");
    expect(TELAS_SEM_COPIA).toContain("/metas");
  });
});
