// Modelos do Gemini em LISTA — o que protege o CRM do desligamento do modelo.
//
// Até 24/09/2026 o CRM chamava um nome só, "gemini-2.5-flash", com desligamento
// anunciado pelo Google para outubro/2026. Estes testes provam: (1) nenhuma
// lista padrão aponta para modelo com desligamento anunciado; (2) modelo que
// some ou esgota a cota passa a vez; (3) erro que outro modelo não resolve
// não queima a lista inteira.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const DESLIGAMENTO_ANUNCIADO = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

describe("listas padrão", () => {
  beforeEach(() => { vi.resetModules(); delete process.env.GEMINI_MODEL; delete process.env.GEMINI_MODEL_CHAT; });

  it("nenhuma lista padrão aponta para modelo com desligamento anunciado", async () => {
    const c = await import("@/lib/ai/config");
    for (const m of [...c.GEMINI_MODELOS_TEXTO, ...c.GEMINI_MODELOS_CHAT, c.GEMINI_MODEL]) {
      expect(DESLIGAMENTO_ANUNCIADO).not.toContain(m);
    }
  });

  it("texto começa pelo Flash-Lite (cota grátis maior); chat pelo Flash (qualidade)", async () => {
    const c = await import("@/lib/ai/config");
    expect(c.GEMINI_MODELOS_TEXTO[0]).toBe("gemini-3.1-flash-lite");
    expect(c.GEMINI_MODELOS_CHAT[0]).toBe("gemini-3.8-flash");
    expect(c.GEMINI_MODEL).toBe(c.GEMINI_MODELOS_TEXTO[0]);
  });

  it("a env vem primeiro e não duplica", async () => {
    process.env.GEMINI_MODEL = "gemini-3.8-flash";
    const c = await import("@/lib/ai/config");
    expect(c.GEMINI_MODELOS_TEXTO[0]).toBe("gemini-3.8-flash");
    expect(c.GEMINI_MODELOS_TEXTO.filter((m) => m === "gemini-3.8-flash")).toHaveLength(1);
  });

  it("env apontando para modelo desligado não trava: os atuais continuam na lista, logo atrás", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    const c = await import("@/lib/ai/config");
    expect(c.GEMINI_MODELOS_TEXTO[0]).toBe("gemini-2.5-flash");
    expect(c.GEMINI_MODELOS_TEXTO).toContain("gemini-3.1-flash-lite");
  });
});

describe("o que fazer com cada erro", () => {
  const agora = new Date("2026-09-24T15:00:00Z");
  it("404 (modelo desligado): próximo modelo, e este fica fora 24 h", async () => {
    const { decidirPeloErro } = await import("@/lib/ai/gemini-modelos");
    const d = decidirPeloErro(404, '{"error":{"status":"NOT_FOUND"}}', agora);
    expect(d.acao).toBe("proximo-modelo");
    if (d.acao === "proximo-modelo") expect(d.ate.getTime() - agora.getTime()).toBe(24 * 3600_000);
  });
  it("429 do plano grátis: próximo modelo (cada um tem a sua cota)", async () => {
    const { decidirPeloErro } = await import("@/lib/ai/gemini-modelos");
    expect(decidirPeloErro(429, "GenerateRequestsPerDayPerProjectPerModel-FreeTier", agora).acao).toBe("proximo-modelo");
  });
  it("400 falando de 'thinking' com raciocínio ligado: repete sem raciocínio", async () => {
    const { decidirPeloErro } = await import("@/lib/ai/gemini-modelos");
    expect(decidirPeloErro(400, "thinking_budget is not supported", agora, true).acao).toBe("sem-raciocinio");
    expect(decidirPeloErro(400, "thinking_budget is not supported", agora, false).acao).toBe("falhar");
  });
  it("chave recusada ou pedido inválido: falha — outro modelo não resolve", async () => {
    const { decidirPeloErro } = await import("@/lib/ai/gemini-modelos");
    expect(decidirPeloErro(401, "API key not valid", agora).acao).toBe("falhar");
    expect(decidirPeloErro(400, "Invalid JSON payload", agora).acao).toBe("falhar");
    expect(decidirPeloErro(500, "internal", agora).acao).toBe("falhar");
  });
});

describe("a fila de modelos, de ponta a ponta (fetch simulado)", () => {
  let chamadas: { modelo: string; corpo: Record<string, unknown> }[] = [];
  const respostas = new Map<string, () => Response>();
  const ok = (texto: string) => () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), { status: 200 });

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.GEMINI_MODEL;
    process.env.GEMINI_API_KEY = "falsa";
    chamadas = []; respostas.clear();
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      const modelo = /models\/([^:]+):/.exec(url)?.[1] ?? "?";
      chamadas.push({ modelo, corpo: JSON.parse(init.body) });
      return (respostas.get(modelo) ?? (() => new Response("not found", { status: 404 })))();
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("o 1º desligado (404): responde o 2º, e o 1º não é tentado de novo na próxima chamada", async () => {
    respostas.set("gemini-3.8-flash", ok("resposta do flash"));
    const { gerarConteudoGemini } = await import("@/lib/ai/gemini-modelos");
    const { zerarCota } = await import("@/lib/ai/imagem-cota"); zerarCota();
    const lista = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
    const r = await gerarConteudoGemini(lista, { contents: [] });
    expect(r.modelo).toBe("gemini-3.8-flash");
    await gerarConteudoGemini(lista, { contents: [] });
    expect(chamadas.map((c) => c.modelo)).toEqual(["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.8-flash"]);
  });

  it("modelo que recusa o raciocínio: repete no MESMO modelo sem ele", async () => {
    let vez = 0;
    respostas.set("gemini-3.1-flash-lite", () => (vez++ === 0 ? new Response("thinking config not supported", { status: 400 }) : ok("ok")()));
    const { gerarConteudoGemini } = await import("@/lib/ai/gemini-modelos");
    const { zerarCota } = await import("@/lib/ai/imagem-cota"); zerarCota();
    const r = await gerarConteudoGemini(["gemini-3.1-flash-lite"], { contents: [], generationConfig: { maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 2048 } } });
    expect(r.modelo).toBe("gemini-3.1-flash-lite");
    expect((chamadas[1].corpo.generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
    expect((chamadas[1].corpo.generationConfig as Record<string, unknown>).maxOutputTokens).toBe(10);
  });

  it("chave recusada: para no primeiro, não gasta a lista inteira", async () => {
    respostas.set("gemini-3.1-flash-lite", () => new Response("API key not valid", { status: 401 }));
    respostas.set("gemini-3.8-flash", ok("não devia chegar aqui"));
    const { gerarConteudoGemini } = await import("@/lib/ai/gemini-modelos");
    const { zerarCota } = await import("@/lib/ai/imagem-cota"); zerarCota();
    await expect(gerarConteudoGemini(["gemini-3.1-flash-lite", "gemini-3.8-flash"], { contents: [] })).rejects.toThrow(/401/);
    expect(chamadas).toHaveLength(1);
  });

  it("todos esgotados: o erro diz QUANDO volta, não um 'falhou' seco", async () => {
    respostas.set("gemini-3.1-flash-lite", () => new Response("FreeTier per day", { status: 429 }));
    const { gerarConteudoGemini } = await import("@/lib/ai/gemini-modelos");
    const { zerarCota } = await import("@/lib/ai/imagem-cota"); zerarCota();
    await expect(gerarConteudoGemini(["gemini-3.1-flash-lite"], { contents: [] })).rejects.toThrow();
    await expect(gerarConteudoGemini(["gemini-3.1-flash-lite"], { contents: [] })).rejects.toThrow(/Volta sozinha/);
    expect(chamadas).toHaveLength(1); // a 2ª nem saiu: já sabia que estava esgotado
  });
});
