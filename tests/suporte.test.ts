import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import {
  recursoLigado, validarAnexos, validarNovoTicket, normalizarTela, assuntoDe, pastaDaTela,
  gerarPromptPronto, bytesDoBase64, statusValido, STATUS_TICKET, LIMITES, ladoValido,
} from "@/lib/suporte-regra";

// Um PNG de 1x1 em base64 (válido e minúsculo).
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("trava do recurso: nasce desligado", () => {
  it("só a palavra exata 'ligado' liga", () => {
    expect(recursoLigado("ligado")).toBe(true);
    for (const v of [undefined, null, "", "Ligado", "ligado ", "on", "1", "true", true, 1, {}]) {
      expect(recursoLigado(v), String(v)).toBe(false);
    }
  });
});

describe("suporteLigado() com banco fora do ar ou valor estranho", () => {
  beforeEach(() => { vi.resetModules(); });
  async function carregar(getConfig: () => Promise<string | null>) {
    vi.doMock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
    vi.doMock("@/lib/db", () => ({ db: {} }));
    vi.doMock("@/lib/config", () => ({ getConfig }));
    return (await import("@/lib/suporte")).suporteLigado;
  }
  it("banco caiu = desligado (não derruba a tela)", async () => {
    const f = await carregar(async () => { throw new Error("Can't reach database server"); });
    await expect(f()).resolves.toBe(false);
  });
  it("sem configuração = desligado", async () => {
    expect(await (await carregar(async () => null))()).toBe(false);
  });
  it("valor inválido = desligado", async () => {
    expect(await (await carregar(async () => "sim"))()).toBe(false);
  });
  it("'ligado' = ligado", async () => {
    expect(await (await carregar(async () => "ligado"))()).toBe(true);
  });
});

describe("status do pedido", () => {
  it("os cinco do pedido do vendedor, nesta ordem", () => {
    expect([...STATUS_TICKET]).toEqual(["novo", "em_analise", "aprovado", "implementado", "descartado"]);
    expect(statusValido("aprovado")).toBe(true);
    expect(statusValido("apagado")).toBe(false);
    expect(ladoValido("admin")).toBe(true);
    expect(ladoValido("dono")).toBe(false);
  });
});

describe("prints", () => {
  it("tamanho real do base64", () => {
    expect(bytesDoBase64("aGVsbG8=")).toBe(5);
    expect(bytesDoBase64("aGVsbG8h")).toBe(6);
  });
  it("sem anexo é válido", () => {
    expect(validarAnexos(undefined)).toEqual({ ok: true, valor: [] });
  });
  it("aceita imagem pequena e limpa o nome", () => {
    const r = validarAnexos([{ mimeType: "image/png", nome: "../../etc/pass<wd>.png", base64: PNG }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor[0].nome).not.toMatch(/[/<>]/);
      expect(r.valor[0].tamanho).toBeGreaterThan(0);
    }
  });
  it("recusa mais que o limite, tipo errado, base64 quebrado e arquivo grande", () => {
    const um = { mimeType: "image/png", nome: "a.png", base64: PNG };
    expect(validarAnexos(Array(LIMITES.anexosPorMensagem + 1).fill(um)).ok).toBe(false);
    expect(validarAnexos([{ ...um, mimeType: "application/pdf" }]).ok).toBe(false);
    expect(validarAnexos([{ ...um, base64: "não é base64!" }]).ok).toBe(false);
    expect(validarAnexos([{ ...um, base64: "A".repeat(Math.ceil((LIMITES.bytesPorAnexo + 10) * 4 / 3)) }]).ok).toBe(false);
    expect(validarAnexos("x").ok).toBe(false);
  });
});

describe("novo pedido", () => {
  it("exige descrição e respeita os limites", () => {
    expect(validarNovoTicket({ descricao: "  " }).ok).toBe(false);
    expect(validarNovoTicket({ descricao: "a".repeat(LIMITES.descricao + 1) }).ok).toBe(false);
    expect(validarNovoTicket({ descricao: "ok", porQue: "b".repeat(LIMITES.porQue + 1) }).ok).toBe(false);
  });
  it("guarda só o caminho da tela, nunca a query (pode ter telefone de cliente)", () => {
    const r = validarNovoTicket({ descricao: "x", tela: "/clientes/abc?telefone=27999998888#topo", contexto: "y".repeat(999) });
    expect(r.ok && r.valor.tela).toBe("/clientes/abc");
    expect(r.ok && r.valor.contexto?.length).toBe(300);
    expect(normalizarTela("https://site/x")).toBeNull();
    expect(normalizarTela(42)).toBeNull();
  });
  it("assunto = primeira linha, curta", () => {
    expect(assuntoDe("Botão some\nno celular")).toBe("Botão some");
    expect(assuntoDe("a".repeat(200)).length).toBeLessThanOrEqual(80);
    expect(assuntoDe("   ")).toBe("Pedido sem título");
  });
});

describe("tela → pasta do código", () => {
  it("aponta para pastas que existem", () => {
    for (const tela of ["/dashboard", "/negociacoes", "/suporte", "/clientes/ckz9a8b7c6d5e4f3g2h1i0j9k8"]) {
      const pasta = pastaDaTela(tela)!;
      expect(existsSync(pasta), `${tela} → ${pasta}`).toBe(true);
    }
    expect(pastaDaTela(null)).toBeNull();
    expect(pastaDaTela("/")).toBeNull();
  });
});

describe("prompt pronto", () => {
  const base = { id: "t1", descricao: "O filtro some\nquando giro o celular", porQue: "uso na rua", tela: "/negociacoes", anexos: 2, criadoEm: new Date("2026-11-05T13:00:00Z") };
  it("leva o pedido, o motivo, a tela, o código provável, os prints e as regras do CLAUDE.md", () => {
    const p = gerarPromptPronto(base);
    expect(p).toContain("> O filtro some\n> quando giro o celular");
    expect(p).toContain("> uso na rua");
    expect(p).toContain("`/negociacoes`");
    expect(p).toContain("src/app/(app)/negociacoes/");
    expect(p).toContain("2 print(s)");
    expect(p).toContain("CLAUDE.md");
    expect(p).toContain("1440");
    expect(p).toContain("05/11/2026, 10:00"); // hora de Brasília (13h UTC)
    expect(p).not.toMatch(/undefined|null/);
  });
  it("sem motivo, sem tela e sem print, continua legível", () => {
    const p = gerarPromptPronto({ ...base, porQue: null, tela: null, anexos: 0 });
    expect(p).toContain("(não informado)");
    expect(p).toContain("Tela: não informada");
    expect(p).toContain("Sem print anexado");
    expect(p).not.toMatch(/undefined|null/);
  });
});

describe("rota POST /api/suporte", () => {
  beforeEach(() => { vi.resetModules(); });
  async function rota(o: { ligado?: boolean; naHora?: number; criar?: () => Promise<{ id: string; assunto: string }>; push?: () => Promise<void> } = {}) {
    const criarTicket = vi.fn(o.criar ?? (async () => ({ id: "t9", assunto: "a" })));
    vi.doMock("@/lib/suporte", () => ({
      suporteLigado: async () => o.ligado ?? true,
      ticketsNaUltimaHora: async () => o.naHora ?? 0,
      criarTicket,
      responderTicket: async (id: string) => id === "existe",
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@vercel/functions", () => ({ waitUntil: (p: Promise<unknown>) => { void p; } }));
    vi.doMock("@/lib/push", () => ({ enviarPushNotificacao: vi.fn(o.push ?? (async () => {})) }));
    const { POST } = await import("@/app/api/suporte/route");
    return { POST, criarTicket };
  }
  const req = (corpo: unknown) => new Request("http://x/api/suporte", { method: "POST", body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

  it("desligado: recusa e não grava", async () => {
    const { POST, criarTicket } = await rota({ ligado: false });
    const r = await POST(req({ acao: "novo", descricao: "x" }));
    expect(r.status).toBe(403);
    expect(criarTicket).not.toHaveBeenCalled();
  });
  it("corpo quebrado: 400 com motivo", async () => {
    const { POST } = await rota();
    const r = await POST(req("{nao json"));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBeTruthy();
  });
  it("muitos pedidos na hora: 429", async () => {
    const { POST, criarTicket } = await rota({ naHora: LIMITES.ticketsPorHora });
    expect((await POST(req({ acao: "novo", descricao: "x" }))).status).toBe(429);
    expect(criarTicket).not.toHaveBeenCalled();
  });
  it("cria o pedido mesmo se o aviso por push falhar", async () => {
    const { POST, criarTicket } = await rota({ push: async () => { throw new Error("push caiu"); } });
    const r = await POST(req({ acao: "novo", descricao: "Erro na tela", tela: "/dashboard", anexos: [{ mimeType: "image/png", nome: "p.png", base64: PNG }] }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ticketId: "t9" });
    expect(criarTicket).toHaveBeenCalledOnce();
  });
  it("banco falhou ao gravar: a tela recebe a mensagem, não um sucesso falso", async () => {
    const { POST } = await rota({ criar: async () => { throw new Error("db"); } });
    const r = await POST(req({ acao: "novo", descricao: "x" }));
    expect(r.status).toBe(500);
    expect((await r.json()).ok).toBe(false);
  });
  it("resposta: pedido inexistente dá 404; lado inválido dá 400", async () => {
    const { POST } = await rota();
    expect((await POST(req({ acao: "responder", ticketId: "nao", lado: "admin", texto: "oi" }))).status).toBe(404);
    expect((await POST(req({ acao: "responder", ticketId: "existe", lado: "hacker", texto: "oi" }))).status).toBe(400);
    expect((await POST(req({ acao: "responder", ticketId: "existe", lado: "admin", texto: "oi" }))).status).toBe(200);
  });
});
