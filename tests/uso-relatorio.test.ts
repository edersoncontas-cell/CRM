// RELATÓRIO DE USO (03/11): o que conta, o que é recusado, o resumo e as
// sugestões. E a rota que soma no banco: um comando por envio, e falha que
// devolve 503 (o navegador guarda e manda de novo) em vez de derrubar algo.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const h = vi.hoisted(() => ({ chamadas: [] as unknown[][], falha: false, pausaExiste: false, cancelou: 0 }));
vi.mock("@/lib/db", () => ({
  db: {
    $executeRawUnsafe: async (...args: unknown[]) => { h.chamadas.push(args); if (h.falha) throw new Error('relation "UsoTela" does not exist'); return 1; },
    configuracao: {
      findUnique: async () => (h.pausaExiste ? { chave: "whatsapp.pausa.v1", valor: "liberado" } : null),
      upsert: async () => ({}),
    },
    envioProgramado: { updateMany: async () => { h.cancelou++; return { count: 3 }; } },
  },
}));

import {
  telaDoCaminho, limparItens, resumirUso, sinalMeta, sugerir, diaHoraBrasilia, segundaDaSemana, fracaoSemanaUtil, fracaoMes,
  duracaoPorExtenso, TELA_ENTRADA, DIAS_ACEITOS_ATRAS, somarDias,
} from "@/lib/uso-regra";
import { TODOS_HREFS, GRUPOS } from "@/lib/menu";
import { POST } from "@/app/api/uso/route";
import { pararEnviosEmMassa } from "@/lib/migrations";

const MENU = GRUPOS.flatMap((g) => g.links.map((l) => ({ href: l.href, label: l.label, fixo: l.fixo })));

describe("que tela conta", () => {
  it("o item do menu mais específico", () => {
    expect(telaDoCaminho("/clientes/abc123", TODOS_HREFS)).toBe("/clientes");
    expect(telaDoCaminho("/maquinas/fichas/x", TODOS_HREFS)).toBe("/maquinas/fichas");
    expect(telaDoCaminho("/dashboard?ano=2026", TODOS_HREFS)).toBe("/dashboard");
    expect(telaDoCaminho("/relatorio", TODOS_HREFS)).toBe("/relatorio");
  });
  it("fora do menu: o primeiro pedaço; o que não é tela: nada", () => {
    expect(telaDoCaminho("/financeiro/comissoes", TODOS_HREFS)).toBe("/financeiro");
    expect(telaDoCaminho("/proposta/abc", TODOS_HREFS)).toBe("/proposta");
    for (const c of ["/", "", "/login", "/api/uso", "x"]) expect(telaDoCaminho(c, TODOS_HREFS)).toBeNull();
  });
});

describe("hora de Brasília", () => {
  it("UTC−3: 02:30 UTC do dia 4 é 23h do dia 3", () => {
    expect(diaHoraBrasilia(Date.parse("2026-11-04T02:30:00Z"))).toEqual({ dia: "2026-11-03", hora: 23 });
  });
  it("a semana começa na segunda", () => {
    expect(segundaDaSemana("2026-11-03")).toBe("2026-11-02"); // terça
    expect(segundaDaSemana("2026-11-08")).toBe("2026-11-02"); // domingo
    expect(segundaDaSemana("2026-11-02")).toBe("2026-11-02");
  });
});

describe("o que a rota aceita", () => {
  const hoje = "2026-11-03";
  const ok = { dia: hoje, hora: 10, tela: "/clientes", aparelho: "pc", dispositivo: "abc12345", aberturas: 2, segundos: 30 };
  it("item bom passa; a mesma linha repetida fica com o MAIOR (é total, não acréscimo)", () => {
    expect(limparItens({ itens: [ok, { ...ok, aberturas: 3, segundos: 10 }] }, hoje)).toEqual([{ ...ok, aberturas: 3, segundos: 30 }]);
  });
  it("dispositivos diferentes são linhas diferentes", () => {
    expect(limparItens({ itens: [ok, { ...ok, dispositivo: "outro999" }] }, hoje)).toHaveLength(2);
  });
  it("recusa o estranho sem derrubar o resto", () => {
    const ruins = [
      { ...ok, dia: "ontem" }, { ...ok, hora: 24 }, { ...ok, tela: "clientes" }, { ...ok, tela: "/a'; drop table" },
      { ...ok, aparelho: "tv" }, { ...ok, aberturas: 0, segundos: 0 }, { ...ok, dia: somarDias(hoje, -(DIAS_ACEITOS_ATRAS + 1)) },
      { ...ok, dia: somarDias(hoje, 2) }, { ...ok, dispositivo: "" }, { ...ok, dispositivo: "x'; --" }, { ...ok, dispositivo: undefined }, null, "x",
    ];
    expect(limparItens({ itens: [...ruins, ok] }, hoje)).toEqual([ok]);
    expect(limparItens(null, hoje)).toEqual([]);
    expect(limparItens({ itens: "nada" }, hoje)).toEqual([]);
  });
  it("número absurdo é aparado, não aceito cru", () => {
    const [i] = limparItens({ itens: [{ ...ok, aberturas: 1e9, segundos: -5 }] }, hoje);
    expect(i.aberturas).toBe(500);
    expect(i.segundos).toBe(0);
    const [j] = limparItens({ itens: [{ ...ok, segundos: 99_999 }] }, hoje);
    expect(j.segundos).toBe(3_600); // uma linha é uma hora
  });
  it("entrada é tela válida", () => {
    expect(limparItens({ itens: [{ ...ok, tela: TELA_ENTRADA }] }, hoje)).toHaveLength(1);
  });
});

describe("resumo", () => {
  const hoje = "2026-11-03"; // terça
  const linhas = [
    { dia: "2026-11-03", hora: 9, tela: TELA_ENTRADA, aparelho: "celular", aberturas: 2, segundos: 0 },
    { dia: "2026-11-02", hora: 8, tela: TELA_ENTRADA, aparelho: "pc", aberturas: 1, segundos: 0 },
    { dia: "2026-10-30", hora: 8, tela: TELA_ENTRADA, aparelho: "pc", aberturas: 4, segundos: 0 },
    { dia: "2026-11-03", hora: 9, tela: "/visitas", aparelho: "celular", aberturas: 3, segundos: 120 },
    { dia: "2026-11-02", hora: 8, tela: "/dashboard", aparelho: "pc", aberturas: 5, segundos: 600 },
    { dia: "2026-09-01", hora: 8, tela: "/comparativo", aparelho: "pc", aberturas: 1, segundos: 10 },
  ];
  const r = resumirUso(linhas, hoje, MENU, "2026-08-20");

  it("entradas no dia, na semana (desde segunda) e no mês", () => {
    expect(r.entradas).toEqual({ hoje: 2, semana: 3, mes: 3 });
    expect(r.tempo).toEqual({ hoje: 120, semana: 720, mes: 720 });
    expect(r.diasComUsoSemana).toBe(2);
  });
  it("entrada não vira tela; telas do menu aparecem mesmo zeradas", () => {
    expect(r.telas.find((t) => t.href === TELA_ENTRADA)).toBeUndefined();
    expect(r.telas[0].href).toBe("/dashboard");
    const comp = r.telas.find((t) => t.href === "/comparativo")!;
    expect(comp.aberturas30).toBe(0);
    expect(comp.ultimoUso).toBe("2026-09-01");
    expect(r.telas.find((t) => t.href === "/academia")!.ultimoUso).toBeNull();
  });
  it("PC × celular e horas, só 30 dias", () => {
    expect(r.aparelho30.celular.aberturas).toBe(3);
    expect(r.aparelho30.pc.aberturas).toBe(5);
    expect(r.porHora30[8]).toBe(5);
    expect(r.porHora30[9]).toBe(3);
  });
  it("começo da contagem vem do MIN quando é mais antigo que a janela", () => {
    expect(r.inicioContagem).toBe("2026-08-20");
    expect(r.diasDeDados).toBe(76);
  });
  it("14 dias, um por dia, terminando hoje", () => {
    expect(r.ultimos14).toHaveLength(14);
    expect(r.ultimos14[13]).toEqual({ dia: hoje, entradas: 2, segundos: 120 });
  });
  it("sem nada: zerado, sem começo", () => {
    const v = resumirUso([], hoje, MENU);
    expect(v.inicioContagem).toBeNull();
    expect(v.diasDeDados).toBe(0);
    expect(v.telas.length).toBe(MENU.length);
  });
});

describe("metas", () => {
  it("compara com o esperado até hoje, não com a meta cheia", () => {
    expect(sinalMeta(0, 20, fracaoSemanaUtil("2026-11-02"))).toBe("verde"); // segunda: nada cobrado ainda
    expect(sinalMeta(8, 20, fracaoSemanaUtil("2026-11-04"))).toBe("verde"); // quarta: esperado 8
    expect(sinalMeta(5, 20, fracaoSemanaUtil("2026-11-04"))).toBe("amarelo");
    expect(sinalMeta(4, 20, fracaoSemanaUtil("2026-11-04"))).toBe("vermelho");
    expect(sinalMeta(3, 20, 0.2)).toBe("amarelo");
    expect(sinalMeta(1, 20, 0.2)).toBe("vermelho");
    expect(sinalMeta(20, 20, 0.1)).toBe("verde");
    expect(sinalMeta(0, 0, 1)).toBe("verde");
  });
  it("frações", () => {
    expect(fracaoSemanaUtil("2026-11-03")).toBeCloseTo(0.2); // terça: a segunda terminou
    expect(fracaoSemanaUtil("2026-11-07")).toBe(1);          // sábado
    expect(fracaoMes("2026-11-16")).toBeCloseTo(0.5);
    expect(fracaoMes("2026-11-01")).toBe(0);
  });
});

describe("sugestões", () => {
  const hoje = "2026-11-03";
  it("com menos de 7 dias de dados, não manda tirar tela nenhuma", () => {
    const r = resumirUso([{ dia: hoje, hora: 9, tela: "/visitas", aparelho: "pc", aberturas: 1, segundos: 5 }], hoje, MENU);
    const s = sugerir(r, []);
    expect(s.every((x) => x.tipo !== "sair")).toBe(true);
    expect(s.some((x) => x.tipo === "aviso")).toBe(true);
  });
  it("com 7+ dias: tela parada vira 'pode sair', mas tela fixa nunca", () => {
    const r = resumirUso([{ dia: hoje, hora: 9, tela: "/visitas", aparelho: "pc", aberturas: 9, segundos: 900 }], hoje, MENU, somarDias(hoje, -10));
    const s = sugerir(r, []);
    const sair = s.filter((x) => x.tipo === "sair");
    expect(sair).toHaveLength(1); // todas numa sugestão só
    const hrefs = sair[0].telas!.map((t) => t.href);
    expect(hrefs).toContain("/academia");
    expect(hrefs).not.toContain("/configuracoes"); // fixa: não dá para esconder
    expect(hrefs).not.toContain("/visitas");
    expect(s.some((x) => x.href === "/visitas")).toBe(false);
  });
  it("abre e sai rápido", () => {
    const r = resumirUso([{ dia: hoje, hora: 9, tela: "/alertas", aparelho: "pc", aberturas: 10, segundos: 30 }], hoje, MENU, somarDias(hoje, -10));
    expect(sugerir(r, []).some((x) => x.tipo === "rapido" && x.href === "/alertas")).toBe(true);
  });
  it("meta vermelha entra primeiro", () => {
    const r = resumirUso([], hoje, MENU);
    const s = sugerir(r, [{ rotulo: "Visitas", valor: 1, meta: 20, sinal: "vermelho", href: "/visitas", dica: "x" }]);
    expect(s[0].tipo).toBe("meta");
  });
  it("duração por extenso", () => {
    expect(duracaoPorExtenso(40)).toBe("40 s");
    expect(duracaoPorExtenso(720)).toBe("12 min");
    expect(duracaoPorExtenso(3900)).toBe("1 h 05 min");
  });
});

describe("rota /api/uso", () => {
  beforeEach(() => { h.chamadas = []; h.falha = false; });
  const pedido = (corpo: unknown) => new Request("http://x/api/uso", { method: "POST", body: JSON.stringify(corpo) });
  const hoje = diaHoraBrasilia(Date.now()).dia;

  it("um comando só; o banco fica com o MAIOR total (reenviar não conta em dobro)", async () => {
    const itens = [
      { dia: hoje, hora: 9, tela: "/visitas", aparelho: "pc", dispositivo: "abc12345", aberturas: 1, segundos: 15 },
      { dia: hoje, hora: 9, tela: TELA_ENTRADA, aparelho: "pc", dispositivo: "abc12345", aberturas: 1, segundos: 0 },
    ];
    const r = await POST(pedido({ itens }));
    expect(r.status).toBe(200);
    expect(h.chamadas).toHaveLength(1);
    const [sql, ...params] = h.chamadas[0] as [string, ...unknown[]];
    expect(sql).toMatch(/ON CONFLICT \("dia", "hora", "tela", "aparelho", "dispositivo"\) DO UPDATE/);
    expect(sql).toMatch(/"aberturas" = GREATEST\("UsoTela"."aberturas", EXCLUDED."aberturas"\)/);
    expect(sql).toMatch(/"segundos"  = GREATEST\("UsoTela"."segundos",  EXCLUDED."segundos"\)/);
    expect(sql).not.toMatch(/\+ EXCLUDED/);
    expect(params).toHaveLength(14);
    expect(sql).not.toContain("/visitas"); // valor vai como parâmetro, nunca colado no SQL
  });

  it("nada válido: não toca no banco", async () => {
    const r = await POST(pedido({ itens: [{ dia: "x" }] }));
    expect(r.status).toBe(200);
    expect(h.chamadas).toHaveLength(0);
  });

  it("banco recusou (tabela ainda não existe): 503, para o navegador guardar", async () => {
    h.falha = true;
    const r = await POST(pedido({ itens: [{ dia: hoje, hora: 9, tela: "/visitas", aparelho: "pc", dispositivo: "abc12345", aberturas: 1, segundos: 0 }] }));
    expect(r.status).toBe(503);
  });

  it("corpo que não é JSON: 400", async () => {
    const r = await POST(new Request("http://x/api/uso", { method: "POST", body: "{" }));
    expect(r.status).toBe(400);
  });
});

describe("a chave de manutenção nova não cancela a fila do Marketing", () => {
  beforeEach(() => { h.cancelou = 0; });
  it("trava já gravada (parada já feita, ou ele mexeu nela): não cancela nada", async () => {
    h.pausaExiste = true;
    await pararEnviosEmMassa();
    expect(h.cancelou).toBe(0);
  });
  it("banco novo, sem a linha da trava: para tudo, como na v44", async () => {
    h.pausaExiste = false;
    await pararEnviosEmMassa();
    expect(h.cancelou).toBe(1);
  });
});

describe("ligações", () => {
  it("o layout monta o contador e o menu tem a tela", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(layout).toMatch(/<RegistroDeUso \/>/);
    expect(TODOS_HREFS).toContain("/relatorio");
  });
  it("a rota de uso fica atrás do login", () => {
    const mw = readFileSync("src/middleware.ts", "utf8");
    expect(mw).not.toMatch(/\/api\/uso/);
  });
});
