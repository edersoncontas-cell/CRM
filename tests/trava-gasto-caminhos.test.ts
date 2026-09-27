import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Complemento de tests/trava-gasto.test.ts (que prova a regra da fila de
// texto). Aqui: a trava valendo para TODOS os caminhos pagos — imagem/PDF,
// agente do chat, transcrição e arte, que passavam por fora dela — e o teto
// diário da análise que o Orientador faz a cada mensagem.

vi.mock("@/lib/db", () => ({ db: { configuracao: { findUnique: async () => null }, $queryRawUnsafe: async () => [] } }));
// lib/ai importa módulos de servidor que usam cache() do React (só existe no Next).
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const CHAVES = ["GEMINI_API_KEY", "GROQ_API_KEY", "DEEPSEEK_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "IA_SOMENTE_GRATUITOS"];
let guardado: Record<string, string | undefined> = {};
beforeEach(() => { guardado = Object.fromEntries(CHAVES.map((k) => [k, process.env[k]])); for (const k of CHAVES) delete process.env[k]; });
afterEach(() => { for (const k of CHAVES) { if (guardado[k] === undefined) delete process.env[k]; else process.env[k] = guardado[k]; } });

describe("trava de gasto: só 'off' libera o pago", () => {
  it("ausente, 'on' ou valor estranho = travado", async () => {
    const { pagoLiberado } = await import("@/lib/ai/trava-gasto");
    expect(pagoLiberado()).toBe(false);
    for (const v of ["on", "", "OFF ", "desligado", "false"]) {
      process.env.IA_SOMENTE_GRATUITOS = v;
      expect(pagoLiberado()).toBe(false);
    }
    process.env.IA_SOMENTE_GRATUITOS = "off";
    expect(pagoLiberado()).toBe(true);
  });
});

describe("com a trava ligada, nenhum caminho pago é usado", () => {
  it("leitura de imagem/PDF: só OpenAI/Anthropic configurados não contam", async () => {
    const { visaoHabilitada } = await import("@/lib/ai");
    process.env.OPENAI_API_KEY = "x"; process.env.ANTHROPIC_API_KEY = "y";
    expect(visaoHabilitada()).toBe(false);
    process.env.IA_SOMENTE_GRATUITOS = "off";
    expect(visaoHabilitada()).toBe(true);
    delete process.env.IA_SOMENTE_GRATUITOS;
    process.env.GEMINI_API_KEY = "g";
    expect(visaoHabilitada()).toBe(true);
  });

  it("agente do chat: DeepSeek e OpenAI ficam de fora", async () => {
    const { provedoresCompat } = await import("@/lib/ai/agente-compat");
    process.env.DEEPSEEK_API_KEY = "d"; process.env.OPENAI_API_KEY = "o";
    expect(provedoresCompat().map((p) => p.nome)).toEqual([]);
    process.env.GROQ_API_KEY = "q";
    expect(provedoresCompat().map((p) => p.nome)).toEqual(["groq"]);
    process.env.IA_SOMENTE_GRATUITOS = "off";
    expect(provedoresCompat().map((p) => p.nome)).toEqual(["groq", "deepseek", "openai"]);
  });

  it("transcrição de áudio: o Whisper da OpenAI não entra", async () => {
    const { isEnabled } = await import("@/lib/integrations/transcription");
    process.env.OPENAI_API_KEY = "o";
    expect(isEnabled()).toBe(false);
    process.env.IA_SOMENTE_GRATUITOS = "off";
    expect(isEnabled()).toBe(true);
  });

  it("arte: a OpenAI não entra, e a tela diz que é a trava (não 'falta chave')", async () => {
    const { geracaoDeImagemHabilitada, motivoSemImagem } = await import("@/lib/ai/imagem");
    process.env.OPENAI_API_KEY = "o";
    expect(geracaoDeImagemHabilitada()).toBe(false);
    expect(motivoSemImagem()).toMatch(/trava de gasto/);
    process.env.IA_SOMENTE_GRATUITOS = "off";
    expect(geracaoDeImagemHabilitada()).toBe(true);
  });
});

describe("teto diário da análise a cada mensagem", () => {
  it("valor estranho na variável vira o padrão — nunca 'sem limite'", async () => {
    const { tetoDiario, TETO_PADRAO } = await import("@/lib/zeus/teto-orientador");
    expect(tetoDiario(undefined)).toBe(TETO_PADRAO);
    expect(tetoDiario("")).toBe(TETO_PADRAO);
    expect(tetoDiario("abc")).toBe(TETO_PADRAO);
    expect(tetoDiario("0")).toBe(TETO_PADRAO);
    expect(tetoDiario("-5")).toBe(TETO_PADRAO);
    expect(tetoDiario("Infinity")).toBe(TETO_PADRAO);
    expect(tetoDiario("80")).toBe(80);
  });
  it("o dia é o de Brasília (23h de lá ainda é o mesmo dia)", async () => {
    const { chaveDoDia } = await import("@/lib/zeus/teto-orientador");
    expect(chaveDoDia(new Date("2026-09-28T02:30:00Z"))).toBe("orientador.analises.2026-09-27");
    expect(chaveDoDia(new Date("2026-09-28T03:30:00Z"))).toBe("orientador.analises.2026-09-28");
  });
  it("sem vaga (banco devolve nada) → nega; banco fora do ar → nega (na dúvida, não gasta)", async () => {
    const mod = await import("@/lib/db");
    const { reservarAnaliseOrientador } = await import("@/lib/zeus/teto-orientador");
    (mod.db as unknown as { $queryRawUnsafe: () => Promise<unknown[]> }).$queryRawUnsafe = async () => [];
    expect((await reservarAnaliseOrientador()).ok).toBe(false);
    (mod.db as unknown as { $queryRawUnsafe: () => Promise<unknown[]> }).$queryRawUnsafe = async () => [{ valor: "3" }];
    expect((await reservarAnaliseOrientador()).ok).toBe(true);
    (mod.db as unknown as { $queryRawUnsafe: () => Promise<unknown[]> }).$queryRawUnsafe = async () => { throw new Error("Can't reach database server"); };
    expect((await reservarAnaliseOrientador()).ok).toBe(false);
  });
  it("o contador do dia nunca vem do banco provisório", async () => {
    const { configPodeVir } = await import("@/lib/trazer-provisorio-regra");
    expect(configPodeVir("orientador.analises.2026-09-27")).toBe(false);
  });
});
