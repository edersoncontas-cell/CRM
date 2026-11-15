import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import {
  resolverPeriodo, validarPedido, diaIsoParaInstante, linkDoPedido, nomeDoArquivo,
  TIPOS_RELATORIO, type RelatorioPronto,
} from "@/lib/relatorio-pedido-regra";
import { formatCurrency } from "@/lib/utils";
import { renderMarkdown } from "@/lib/cerebro-markdown";
import { validarAudio, limparTranscricao, extensaoDoMime, escolherMime, formatarTempo, LIMITES_VOZ } from "@/lib/voz-regra";
import { gerarPdfPedido, gerarXlsxPedido } from "@/lib/relatorio-pedido-arquivo";

// 15/11/2026 14:00 em Brasília (= 17:00 UTC), um domingo.
const AGORA = new Date("2026-11-15T17:00:00Z");
const iso = (d: Date) => d.toISOString();

describe("períodos em horário de Brasília", () => {
  it("este mês vai de 01/11 00:00 BRT a 01/12 00:00 BRT", () => {
    const p = resolverPeriodo("mes", AGORA);
    expect(iso(p.de)).toBe("2026-11-01T03:00:00.000Z");
    expect(iso(p.ate)).toBe("2026-12-01T03:00:00.000Z");
    expect(p.rotulo).toBe("novembro de 2026");
  });
  it("madrugada de Brasília ainda é o dia anterior em UTC: 01/12 01:00 BRT é dezembro", () => {
    const p = resolverPeriodo("mes", new Date("2026-12-01T04:00:00Z"));
    expect(p.rotulo).toBe("dezembro de 2026");
    // e 30/11 23:30 BRT (= 02:30 UTC de 01/12) ainda é novembro
    expect(resolverPeriodo("mes", new Date("2026-12-01T02:30:00Z")).rotulo).toBe("novembro de 2026");
  });
  it("mês passado em janeiro volta para dezembro do ano anterior", () => {
    const p = resolverPeriodo("mes_passado", new Date("2027-01-10T15:00:00Z"));
    expect(p.rotulo).toBe("dezembro de 2026");
    expect(iso(p.de)).toBe("2026-12-01T03:00:00.000Z");
    expect(iso(p.ate)).toBe("2027-01-01T03:00:00.000Z");
  });
  it("semana começa na segunda (domingo 15/11 pertence à semana de 09/11)", () => {
    const p = resolverPeriodo("semana", AGORA);
    expect(iso(p.de)).toBe("2026-11-09T03:00:00.000Z");
    expect(iso(p.ate)).toBe("2026-11-16T03:00:00.000Z");
  });
  it("trimestre e ano", () => {
    expect(resolverPeriodo("trimestre", AGORA).rotulo).toBe("4º trimestre de 2026");
    expect(iso(resolverPeriodo("trimestre", AGORA).ate)).toBe("2027-01-01T03:00:00.000Z");
    expect(iso(resolverPeriodo("ano", AGORA).de)).toBe("2026-01-01T03:00:00.000Z");
  });
  it("hoje e últimos 30 dias incluem o dia de hoje inteiro", () => {
    const h = resolverPeriodo("hoje", AGORA);
    expect(h.ate.getTime() - h.de.getTime()).toBe(24 * 3600 * 1000);
    const u = resolverPeriodo("ultimos_30_dias", AGORA);
    expect(u.ate.getTime() - u.de.getTime()).toBe(30 * 24 * 3600 * 1000);
    expect(iso(u.ate)).toBe(iso(h.ate));
  });
});

describe("datas AAAA-MM-DD", () => {
  it("aceita data real e recusa lixo", () => {
    expect(iso(diaIsoParaInstante("2026-11-05")!)).toBe("2026-11-05T03:00:00.000Z");
    for (const x of ["2026-02-31", "2026-13-01", "05/11/2026", "", null, undefined, 20261105, "1999-01-01", "2026-11-5"]) {
      expect(diaIsoParaInstante(x), String(x)).toBeNull();
    }
  });
});

describe("validarPedido", () => {
  it("padrão: PDF, este mês", () => {
    const v = validarPedido({ tipo: "vendas" }, AGORA);
    expect(v.ok && v.valor.formato).toBe("pdf");
    expect(v.ok && v.valor.periodo?.rotulo).toBe("novembro de 2026");
  });
  it("recusa tipo, formato, período e dias inválidos, dizendo o motivo", () => {
    const erro = (e: Record<string, unknown>) => { const v = validarPedido(e, AGORA); return v.ok ? null : v.erro; };
    expect(erro({})).toMatch(/Tipo/);
    expect(erro({ tipo: "tudo" })).toMatch(/Tipo/);
    expect(erro({ tipo: "vendas", formato: "docx" })).toMatch(/Formato/);
    expect(erro({ tipo: "vendas", periodo: "ontem" })).toMatch(/Período/);
    expect(erro({ tipo: "parados", dias: 0 })).toMatch(/dias/);
    expect(erro({ tipo: "parados", dias: 1.5 })).toMatch(/dias/);
    expect(erro({ tipo: "parados", dias: 9999 })).toMatch(/dias/);
    expect(erro({ tipo: "parados", dias: "abc" })).toMatch(/dias/);
  });
  it("intervalo de/ate vence o nome do período; ate é inclusivo", () => {
    const v = validarPedido({ tipo: "visitas", periodo: "ano", de: "2026-11-01", ate: "2026-11-30" }, AGORA);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(iso(v.valor.periodo!.de)).toBe("2026-11-01T03:00:00.000Z");
      expect(iso(v.valor.periodo!.ate)).toBe("2026-12-01T03:00:00.000Z");
      expect(v.valor.periodo!.rotulo).toBe("01/11/2026 a 30/11/2026");
    }
  });
  it("intervalo incompleto, invertido ou grande demais é recusado", () => {
    const erro = (e: Record<string, unknown>) => { const v = validarPedido(e, AGORA); return v.ok ? null : v.erro; };
    expect(erro({ tipo: "vendas", de: "2026-11-01" })).toMatch(/Datas inválidas/);
    expect(erro({ tipo: "vendas", de: "2026-11-30", ate: "2026-11-01" })).toMatch(/antes/);
    expect(erro({ tipo: "vendas", de: "2020-01-01", ate: "2026-11-01" })).toMatch(/grande demais/);
  });
  it("retratos de agora ignoram período (não enganam com 'mês passado')", () => {
    for (const tipo of ["funil", "parados", "sem_resposta"]) {
      const v = validarPedido({ tipo, periodo: "mes_passado" }, AGORA);
      expect(v.ok && v.valor.periodo).toBeNull();
    }
  });
  it("'parados' usa 10 dias por padrão", () => {
    const v = validarPedido({ tipo: "parados" }, AGORA);
    expect(v.ok && v.valor.diasParado).toBe(10);
  });
});

describe("link do relatório", () => {
  it("o link gerado sempre passa na validação e só tem caracteres seguros", () => {
    for (const e of [
      { tipo: "vendas", periodo: "mes_passado", formato: "xlsx" },
      { tipo: "visitas", de: "2026-11-01", ate: "2026-11-10" },
      { tipo: "parados", dias: 15 },
      { tipo: "funil" },
    ] as Record<string, unknown>[]) {
      const v = validarPedido(e, AGORA);
      expect(v.ok).toBe(true);
      if (!v.ok) continue;
      const link = linkDoPedido(v.valor, e);
      expect(link).toMatch(/^\/api\/relatorios\?[A-Za-z0-9_=&.%-]+$/);
      const volta = validarPedido(Object.fromEntries(new URL(link, "http://x").searchParams.entries()), AGORA);
      expect(volta.ok).toBe(true);
      if (volta.ok) { expect(volta.valor.tipo).toBe(v.valor.tipo); expect(volta.valor.formato).toBe(v.valor.formato); }
    }
  });
  it("nome do arquivo usa o dia de Brasília", () => {
    expect(nomeDoArquivo({ tipo: "sem_resposta" }, "xlsx", new Date("2026-11-16T01:00:00Z"))).toBe("relatorio-sem-resposta-2026-11-15.xlsx");
  });
});

describe("texto do chat: só o link do relatório ganha vida", () => {
  it("renderiza o link do relatório", () => {
    const h = renderMarkdown("[Baixar](/api/relatorios?tipo=vendas&periodo=mes&formato=pdf)");
    expect(h).toContain('<a href="/api/relatorios?tipo=vendas&amp;periodo=mes&amp;formato=pdf"');
    expect(h).toContain('rel="noopener"');
  });
  it("outros destinos continuam texto puro", () => {
    for (const md of [
      "[x](https://evil.com)", "[x](javascript:alert(1))", "[x](//evil.com)", "[x](/api/outra?a=1)",
      '[x](/api/relatorios?a="onmouseover=alert(1))', "[x](/api/relatorios?a=<script>)",
    ]) {
      expect(renderMarkdown(md), md).not.toContain("<a ");
    }
  });
  it("HTML solto na resposta continua escapado", () => {
    expect(renderMarkdown("<img src=x onerror=alert(1)>")).not.toContain("<img");
  });
});

describe("voz: regras", () => {
  it("áudio vazio, enorme ou inválido é recusado com mensagem", () => {
    expect(validarAudio(0)).toMatchObject({ ok: false });
    expect(validarAudio(NaN)).toMatchObject({ ok: false });
    expect(validarAudio(LIMITES_VOZ.bytesMax + 1)).toMatchObject({ ok: false });
    expect(validarAudio(1000)).toEqual({ ok: true });
  });
  it("Safari só grava mp4; Chrome prefere webm", () => {
    expect(escolherMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(escolherMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(escolherMime(() => false)).toBeUndefined();
  });
  it("extensão, limpeza e tempo", () => {
    expect(extensaoDoMime("audio/mp4")).toBe("m4a");
    expect(extensaoDoMime("audio/webm;codecs=opus")).toBe("webm");
    expect(limparTranscricao("  gera   o relatório \n de vendas ")).toBe("gera o relatório de vendas");
    expect(limparTranscricao("   ")).toBe("");
    expect(limparTranscricao("a".repeat(5000)).length).toBe(LIMITES_VOZ.textoMax);
    expect(formatarTempo(75)).toBe("1:15");
    expect(formatarTempo(-3)).toBe("0:00");
  });
});

const REL: RelatorioPronto = {
  tipo: "vendas", titulo: "Vendas fechadas", subtitulo: "novembro de 2026",
  resumo: [{ rotulo: "Vendas", valor: "2" }, { rotulo: "Valor total", valor: "R$ 300.000" }],
  colunas: ["Faturado em", "Cliente", "Valor"],
  linhas: [["05/11/2026", "João da Silva 😀", "R$ 100.000"], ["=1+1", "Maria", "R$ 200.000"]],
  cortado: false,
};

describe("arquivos", () => {
  it("PDF válido, com e sem linhas, e com muitas linhas (várias páginas)", () => {
    const pdf = gerarPdfPedido(REL, AGORA);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(gerarPdfPedido({ ...REL, linhas: [] }, AGORA).subarray(0, 5).toString()).toBe("%PDF-");
    const grande = gerarPdfPedido({ ...REL, linhas: Array.from({ length: 300 }, (_, i) => [`01/11/2026`, `Cliente ${i}`, "R$ 1"]), cortado: true }, AGORA);
    expect(grande.length).toBeGreaterThan(pdf.length);
    expect(grande.toString("latin1").match(/\/Type\s*\/Page[^s]/g)!.length).toBeGreaterThan(3);
  });
  it("planilha abre, tem cabeçalho e guarda '=1+1' como TEXTO (não vira fórmula)", async () => {
    const buf = await gerarXlsxPedido(REL, AGORA);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    const textos: string[] = [];
    ws.eachRow((r) => r.eachCell((c) => { textos.push(String(c.value)); }));
    expect(textos).toContain("Vendas fechadas");
    expect(textos).toContain("Faturado em");
    expect(textos).toContain("João da Silva 😀");
    const celula = ws.getRow(ws.rowCount).getCell(1);
    expect(typeof celula.value).toBe("string");
    expect(celula.value).toBe("=1+1");
  });
  it("planilha vazia diz que não achou nada", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await gerarXlsxPedido({ ...REL, linhas: [] }, AGORA)) as unknown as ExcelJS.Buffer);
    const textos: string[] = [];
    wb.worksheets[0].eachRow((r) => r.eachCell((c) => { textos.push(String(c.value)); }));
    expect(textos.join("|")).toContain("Nada encontrado");
  });
});

describe("montarRelatorio (banco simulado)", () => {
  beforeEach(() => { vi.resetModules(); });
  async function carregar(db: unknown) {
    vi.doMock("@/lib/db", () => ({ db }));
    return (await import("@/lib/relatorio-pedido")).montarRelatorio;
  }
  const pedido = (e: Record<string, unknown>) => { const v = validarPedido(e, AGORA); if (!v.ok) throw new Error(v.erro); return v.valor; };

  it("vendas usa o MESMO critério da meta (status ganha + faturadoEm no período) e soma o valor", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { faturadoEm: new Date("2026-11-05T15:00:00Z"), marca: "New Holland", maquinaModelo: "B95C", valor: 400000, tipoPagamento: "financiamento", cliente: { nome: "Ana", municipio: { nome: "Cachoeiro" } } },
      { faturadoEm: new Date("2026-11-07T15:00:00Z"), marca: null, maquinaModelo: null, valor: null, tipoPagamento: null, cliente: { nome: "Beto", municipio: null } },
    ]);
    const montar = await carregar({ negociacao: { findMany } });
    const r = await montar(pedido({ tipo: "vendas", periodo: "mes" }), AGORA);
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe("ganha");
    expect(iso(where.faturadoEm.gte)).toBe("2026-11-01T03:00:00.000Z");
    expect(iso(where.faturadoEm.lt)).toBe("2026-12-01T03:00:00.000Z");
    expect(r.resumo).toContainEqual({ rotulo: "Vendas", valor: "2" });
    expect(r.linhas[0][1]).toBe("Ana");
    expect(r.aviso).toMatch(/1 venda\(s\) sem valor/);
    expect(r.cortado).toBe(false);
  });

  it("passou do limite de linhas: corta e AVISA que cortou", async () => {
    const muitas = Array.from({ length: 1001 }, () => ({ faturadoEm: new Date("2026-11-05T15:00:00Z"), marca: null, maquinaModelo: null, valor: 1, tipoPagamento: null, cliente: { nome: "X", municipio: null } }));
    const montar = await carregar({ negociacao: { findMany: vi.fn().mockResolvedValue(muitas) } });
    const r = await montar(pedido({ tipo: "vendas" }), AGORA);
    expect(r.linhas.length).toBe(1000);
    expect(r.cortado).toBe(true);
  });

  it("parados: 'OR' entra dentro do AND (armadilha do Prisma) e ordena do mais antigo", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { estagio: "PROPOSTA", valor: 10, ultimoContato: new Date("2026-11-01T12:00:00Z"), criadoEm: new Date("2026-10-01T12:00:00Z"), marca: null, maquinaModelo: null, cliente: { nome: "Recente" } },
      { estagio: "OPORTUNIDADE", valor: 20, ultimoContato: null, criadoEm: new Date("2026-09-01T12:00:00Z"), marca: null, maquinaModelo: null, cliente: { nome: "Esquecida" } },
    ]);
    const montar = await carregar({ negociacao: { findMany } });
    const r = await montar(pedido({ tipo: "parados", dias: 10 }), AGORA);
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe("aberta");
    expect(where.OR).toBeUndefined();
    expect(Array.isArray(where.AND)).toBe(true);
    expect(r.linhas.map((l) => l[0])).toEqual(["Esquecida", "Recente"]);
  });

  it("funil agrupa por etapa na ordem do quadro; sem quadro (consulta falha) ainda funciona", async () => {
    const abertas = [
      { estagio: "PROPOSTA", valor: 100 }, { estagio: "OPORTUNIDADE", valor: 50 }, { estagio: "PROPOSTA", valor: null },
    ];
    const montar = await carregar({
      negociacao: { findMany: vi.fn().mockResolvedValue(abertas) },
      colunaFunil: { findMany: vi.fn().mockRejectedValue(new Error("tabela não existe")) },
    });
    const r = await montar(pedido({ tipo: "funil" }), AGORA);
    expect(r.linhas.find((l) => l[0] === "PROPOSTA")).toEqual(["PROPOSTA", "2", formatCurrency(100)]);
    expect(r.resumo[0]).toEqual({ rotulo: "Negociações abertas", valor: "3" });
  });

  it("banco fora do ar: o erro sobe (a rota diz que falhou, não devolve relatório vazio)", async () => {
    const montar = await carregar({ visita: { findMany: vi.fn().mockRejectedValue(new Error("Can't reach database")) } });
    await expect(montar(pedido({ tipo: "visitas" }), AGORA)).rejects.toThrow(/database/);
  });

  it("todos os tipos estão cobertos pelo montador", () => {
    expect(TIPOS_RELATORIO.length).toBe(5);
  });
});
