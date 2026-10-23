// O agendador do CRM (23/10, "o WhatsApp não está mais funcionando"): quem
// vigia e religa o WhatsApp é o /api/cron/tudo, chamado por um agendador
// EXTERNO grátis (cron-job.org). Parado ele, nada vigiava e a tela não dizia.
//
// O que estes testes travam:
//  1. A régua: "parou" só com a chamada do agendador externo (a rede de
//     segurança do navegador e o cron diário da Vercel NÃO escondem o problema);
//     sem registro ou registro ilegível = parado (nunca esconde).
//  2. A rede de segurança: o CRM aberto roda a passada quando nada rodou há
//     mais de 20 min — e não roda quando está tudo em dia.
//  3. As marcas: cada origem grava a SUA chave.
//  4. A tela avisa, e o layout monta a batida.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { saudeAgendador, precisaBater, haQuanto, TOLERANCIA_PARADO_MIN, BATIDA_SE_ATRASADO_MIN } from "@/lib/agendador-regra";

const ler = (f: string) => readFileSync(f, "utf8");
const AGORA = new Date("2026-10-23T15:00:00.000Z");
const minAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString();

describe("saudeAgendador (o cron-job.org está chamando?)", () => {
  it("chamou há 15 min: ok", () => {
    expect(saudeAgendador(minAtras(15), AGORA)).toMatchObject({ tipo: "ok", minutos: 15 });
  });
  it("no limite da tolerância ainda é ok; um minuto depois, parado", () => {
    expect(saudeAgendador(minAtras(TOLERANCIA_PARADO_MIN), AGORA).tipo).toBe("ok");
    expect(saudeAgendador(minAtras(TOLERANCIA_PARADO_MIN + 1), AGORA)).toMatchObject({ tipo: "parado", minutos: TOLERANCIA_PARADO_MIN + 1 });
  });
  it("sem registro, vazio ou ilegível: PARADO (o padrão não esconde o problema)", () => {
    for (const v of [null, undefined, "", "lixo"]) expect(saudeAgendador(v, AGORA)).toMatchObject({ tipo: "parado", ultima: null });
  });
  it("relógio do servidor atrás do registro (data no futuro) não é queda", () => {
    expect(saudeAgendador(new Date(AGORA.getTime() + 5 * 60_000).toISOString(), AGORA).tipo).toBe("ok");
  });
});

describe("precisaBater (o CRM aberto cobre o agendador morto)", () => {
  it("nada nunca rodou: bate", () => {
    expect(precisaBater(null, null, AGORA)).toBe(true);
    expect(precisaBater("lixo", undefined, AGORA)).toBe(true);
  });
  it("o agendador chamou há 10 min: não bate", () => {
    expect(precisaBater(minAtras(10), null, AGORA)).toBe(false);
  });
  it("o agendador parou há horas, mas o navegador rodou há 5 min: não bate de novo", () => {
    expect(precisaBater(minAtras(300), minAtras(5), AGORA)).toBe(false);
  });
  it("os dois velhos (> 20 min): bate", () => {
    expect(precisaBater(minAtras(BATIDA_SE_ATRASADO_MIN + 1), minAtras(120), AGORA)).toBe(true);
    expect(precisaBater(minAtras(BATIDA_SE_ATRASADO_MIN), null, AGORA)).toBe(false); // no limite ainda não
  });
  it("a batida do navegador NÃO conserta o aviso: parado continua parado", () => {
    // A tela compara só a chamada externa — senão a primeira abertura apagaria o aviso e o cron-job.org morto ficaria escondido.
    expect(saudeAgendador(minAtras(300), AGORA).tipo).toBe("parado");
  });
});

describe("haQuanto", () => {
  it("escreve em português", () => {
    expect(haQuanto(null)).toBe("nunca chamou");
    expect(haQuanto(0)).toBe("há 1 min");
    expect(haQuanto(45)).toBe("há 45 min");
    expect(haQuanto(180)).toBe("há 3 h");
    expect(haQuanto(60 * 24 * 3)).toBe("há 3 dias");
  });
});

// ── As marcas e as rotas ────────────────────────────────────────────────────

const mem = vi.hoisted(() => ({ cfg: new Map<string, string>(), chamadas: [] as string[] }));
vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(async (k: string) => mem.cfg.get(k) ?? null),
  setConfig: vi.fn(async (k: string, v: string) => { mem.cfg.set(k, v); }),
}));

function req(url: string, init?: { method?: string; headers?: Record<string, string> }) {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, init);
}

describe("rodarPassada grava a marca da sua origem", () => {
  beforeEach(() => {
    mem.cfg.clear();
    mem.chamadas = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { mem.chamadas.push(String(u)); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }));
  });

  it("agendador externo: grava cron.tudo.passada e dispara as rotinas que estão na hora", async () => {
    const { rodarPassada, CHAVE_PASSADA_EXTERNA, CHAVE_PASSADA_SEGURANCA } = await import("@/lib/agendador");
    const r = await rodarPassada({ base: "http://x", segredo: "s", origem: "agendador" });
    expect(r.ok).toBe(true);
    expect(mem.cfg.has(CHAVE_PASSADA_EXTERNA)).toBe(true);
    expect(mem.cfg.has(CHAVE_PASSADA_SEGURANCA)).toBe(false);
    expect(mem.chamadas.some((u) => u.endsWith("/api/cron/whatsapp-vigia"))).toBe(true);
  });

  it("rede de segurança: grava a OUTRA marca (e a externa fica como estava)", async () => {
    const { rodarPassada, CHAVE_PASSADA_EXTERNA, CHAVE_PASSADA_SEGURANCA } = await import("@/lib/agendador");
    await rodarPassada({ base: "http://x", origem: "seguranca" });
    expect(mem.cfg.has(CHAVE_PASSADA_SEGURANCA)).toBe(true);
    expect(mem.cfg.has(CHAVE_PASSADA_EXTERNA)).toBe(false);
  });

  it("uma rotina que acabou de rodar não roda de novo (a passada é idempotente)", async () => {
    const { rodarPassada } = await import("@/lib/agendador");
    await rodarPassada({ base: "http://x", origem: "agendador" });
    const primeira = mem.chamadas.length;
    await rodarPassada({ base: "http://x", origem: "seguranca" });
    expect(mem.chamadas.length).toBe(primeira);
  });
});

describe("rota mestre /api/cron/tudo", () => {
  beforeEach(() => {
    mem.cfg.clear();
    mem.chamadas = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { mem.chamadas.push(String(u)); return new Response("{}", { status: 200 }); }));
    vi.stubEnv("CRON_SECRET", "segredo");
  });

  it("sem a chave: 401 e nada roda nem é marcado", async () => {
    const { GET } = await import("@/app/api/cron/tudo/route");
    const res = await GET(req("http://x/api/cron/tudo"));
    expect(res.status).toBe(401);
    expect(mem.cfg.size).toBe(0);
    expect(mem.chamadas).toEqual([]);
  });

  it("chamada do agendador externo conta como 'o agendador chamou'", async () => {
    const { GET } = await import("@/app/api/cron/tudo/route");
    const { CHAVE_PASSADA_EXTERNA } = await import("@/lib/agendador");
    const res = await GET(req("http://x/api/cron/tudo", { headers: { authorization: "Bearer segredo", "user-agent": "cron-job.org" } }));
    expect(res.status).toBe(200);
    expect(mem.cfg.has(CHAVE_PASSADA_EXTERNA)).toBe(true);
  });

  it("o cron diário da Vercel NÃO conta (senão escondia o cron-job.org parado por 40 min a cada dia)", async () => {
    const { GET } = await import("@/app/api/cron/tudo/route");
    const { CHAVE_PASSADA_EXTERNA, CHAVE_PASSADA_SEGURANCA } = await import("@/lib/agendador");
    await GET(req("http://x/api/cron/tudo", { headers: { authorization: "Bearer segredo", "user-agent": "vercel-cron/1.0" } }));
    expect(mem.cfg.has(CHAVE_PASSADA_EXTERNA)).toBe(false);
    expect(mem.cfg.has(CHAVE_PASSADA_SEGURANCA)).toBe(true);
  });
});

describe("rota da rede de segurança /api/agendador/batida", () => {
  beforeEach(() => {
    mem.cfg.clear();
    mem.chamadas = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { mem.chamadas.push(String(u)); return new Response("{}", { status: 200 }); }));
  });

  it("tudo em dia (agendador chamou há 5 min): responde sem rodar nada", async () => {
    const { POST } = await import("@/app/api/agendador/batida/route");
    mem.cfg.set("cron.tudo.passada", new Date(Date.now() - 5 * 60_000).toISOString());
    const res = await POST(req("http://x/api/agendador/batida", { method: "POST" }));
    expect(await res.json()).toEqual({ ok: true, rodou: false });
    expect(mem.chamadas).toEqual([]);
  });

  it("agendador parado há horas: roda a passada (vigia do WhatsApp incluído) e marca a batida", async () => {
    const { POST } = await import("@/app/api/agendador/batida/route");
    mem.cfg.set("cron.tudo.passada", new Date(Date.now() - 5 * 3_600_000).toISOString());
    const res = await POST(req("http://x/api/agendador/batida", { method: "POST" }));
    const j = await res.json();
    expect(j.rodou).toBe(true);
    expect(mem.chamadas.some((u) => u.endsWith("/api/cron/whatsapp-vigia"))).toBe(true);
    expect(mem.cfg.get("cron.tudo.passada")).toBeDefined();
    expect(Date.now() - new Date(mem.cfg.get("cron.tudo.batida") as string).getTime()).toBeLessThan(60_000);
    // a marca do agendador externo NÃO foi renovada: a tela continua dizendo que ele parou
    expect(Date.now() - new Date(mem.cfg.get("cron.tudo.passada") as string).getTime()).toBeGreaterThan(4 * 3_600_000);
  });

  it("nunca rodou nada: roda", async () => {
    const { POST } = await import("@/app/api/agendador/batida/route");
    const j = await (await POST(req("http://x/api/agendador/batida", { method: "POST" }))).json();
    expect(j.rodou).toBe(true);
  });
});

describe("as telas", () => {
  it("a tela de Conexão avisa quando o agendador parou (só a chamada externa conta)", () => {
    const s = ler("src/app/(app)/conexao/page.tsx");
    expect(s).toContain("<AvisoAgendadorParado saude={agendador} />");
    expect(s).toMatch(/saudeAgendador\(\(await lerPassadas\(\)\)\.externa/);
  });

  it("o layout monta a batida, só com o banco de pé", () => {
    const s = ler("src/app/(app)/layout.tsx");
    expect(s).toMatch(/saude\.ok && !recemCriado && <BatidaDoAgendador \/>/);
  });

  it("a batida só age com a tela visível e com internet, e não bate mais que a cada 10 min", () => {
    const s = ler("src/components/BatidaDoAgendador.tsx");
    expect(s).toContain('document.visibilityState !== "visible"');
    expect(s).toContain("navigator.onLine === false");
    expect(s).toContain("INTERVALO_BATIDA_AGENDADOR");
    expect(s).toMatch(/setInterval\(\(\) => \{ if \(document\.visibilityState === "visible"\) void bater\(\); \}, INTERVALO_BATIDA_AGENDADOR\)/);
  });

  it("a rota da batida fica atrás do login (não é rota pública do middleware)", () => {
    const m = ler("src/middleware.ts");
    expect(m).not.toMatch(/api\/agendador/);
  });
});

// ── A tela não pode dizer "Conectado" com informação velha ─────────────────
import { descreverConexao, MEMORIA_VAZIA, type MemoriaVigia } from "@/lib/whatsapp-vigia-regra";

describe("descreverConexao diz DE QUANDO é a informação (o 'Conectado' que ficou debaixo do QR)", () => {
  const mem = (p: Partial<MemoriaVigia>): MemoriaVigia => ({ ...MEMORIA_VAZIA, ...p });
  it("verificação recente: sem aviso de idade", () => {
    const t = descreverConexao(mem({ ultimoEstado: "aberta", conectadaDesde: minAtras(200), ultimaVerificacao: minAtras(4) }), AGORA);
    expect(t).toBe("Conectado há 3h");
  });
  it("o vigia não confere há horas: a frase diz que pode estar velha", () => {
    const t = descreverConexao(mem({ ultimoEstado: "aberta", conectadaDesde: minAtras(900), ultimaVerificacao: minAtras(300) }), AGORA);
    expect(t).toContain("Conectado há 15h");
    expect(t).toMatch(/última verificação do vigia: .* \(ele não confere desde então/);
  });
  it("vale também para 'fora do ar' e 'servidor sem responder'", () => {
    expect(descreverConexao(mem({ ultimoEstado: "fechada", ultimaQueda: minAtras(400), ultimaVerificacao: minAtras(380), tentativas: 1 }), AGORA)).toMatch(/ele não confere desde então/);
    expect(descreverConexao(mem({ ultimoEstado: "fechada", servidorForaDesde: minAtras(400), ultimaVerificacao: minAtras(380) }), AGORA)).toMatch(/ele não confere desde então/);
  });
  it("a tela desconectada não repete 'Conectado há…' quando o vigia ficou para trás", () => {
    const s = ler("src/components/ConexaoWhatsApp.tsx");
    expect(s).toContain('vigia?.ultimoEstado === "aberta" ? "Desconectado agora');
  });
});
