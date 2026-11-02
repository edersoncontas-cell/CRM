// RITMO POR HORA E O CRM QUE SÓ ESPELHA (02/11).
//
// "remova a questão de enviar mensagem pelo CRM, quero que o whatsapp apenas
//  espelhe [...] e também manter um padrão de envio, por exemplo enviar para
//  5 clientes a cada hora."
//
// Três coisas são provadas aqui:
//   1. a regra do ritmo (5/h = uma a cada 12 min, nunca 5 de uma vez);
//   2. o padrão que não machuca: ritmo inválido/zerado e banco fora do ar
//      NÃO mandam;
//   3. nenhum caminho novo de envio a cliente aparece sem passar pelo funil.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LIMITES_PADRAO, proximaNoRitmo, intervaloDoRitmoMs, explicarRitmo, descreverRitmo,
  horasParaTerminar, diasParaTerminar,
} from "@/lib/envio-limites";
import { linkWhatsApp, numeroParaWaMe } from "@/lib/whatsapp-link";

const agora = new Date("2026-11-02T10:00:00-03:00");
const minAtras = (m: number) => new Date(agora.getTime() - m * 60_000);
const lim5 = { ...LIMITES_PADRAO, porHora: 5 };

describe("o ritmo por hora", () => {
  it("o padrão é 5 por hora", () => {
    expect(LIMITES_PADRAO.porHora).toBe(5);
  });

  it("5 por hora = uma a cada 12 minutos", () => {
    expect(intervaloDoRitmoMs(lim5)).toBe(12 * 60_000);
  });

  it("sem nada na última hora, pode agora", () => {
    expect(proximaNoRitmo([], agora, lim5)).toBeNull();
  });

  it("a anterior saiu há 5 min: espera completar os 12", () => {
    const p = proximaNoRitmo([minAtras(5)], agora, lim5);
    expect(p?.getTime()).toBe(minAtras(5).getTime() + 12 * 60_000);
  });

  it("a anterior saiu há 12 min: pode", () => {
    expect(proximaNoRitmo([minAtras(12)], agora, lim5)).toBeNull();
  });

  it("5 na última hora, mesmo espaçadas, segura até a mais antiga fazer 1 hora", () => {
    // 5 mensagens em 50 min; a última há 13 min (passou o espaço de 12), mas
    // a hora já tem 5.
    const p = proximaNoRitmo([minAtras(58), minAtras(48), minAtras(36), minAtras(24), minAtras(13)], agora, { ...lim5 });
    expect(p?.getTime()).toBe(minAtras(58).getTime() + 3_600_000);
  });

  it("nunca deixa sair 5 de uma vez, mesmo com a hora vazia antes", () => {
    const recentes: Date[] = [];
    let saiu = 0;
    // Simula o despachante perguntando a cada minuto por 60 min.
    for (let m = 0; m < 60; m++) {
      const t = new Date(agora.getTime() + m * 60_000);
      if (!proximaNoRitmo(recentes, t, lim5)) { recentes.push(t); saiu++; }
    }
    expect(saiu).toBe(5);
    const gaps = recentes.slice(1).map((d, i) => d.getTime() - recentes[i].getTime());
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(12 * 60_000);
  });

  it("em qualquer janela de 60 min, nunca mais que porHora (varredura de 6 h, vários ritmos)", () => {
    for (const porHora of [1, 2, 3, 5, 10, 20]) {
      const lim = { ...LIMITES_PADRAO, porHora };
      const saidas: number[] = [];
      for (let m = 0; m < 360; m++) {
        const t = new Date(agora.getTime() + m * 60_000);
        if (!proximaNoRitmo(saidas.map((x) => new Date(x)), t, lim)) saidas.push(t.getTime());
      }
      for (const inicio of saidas) {
        const naJanela = saidas.filter((x) => x >= inicio && x < inicio + 3_600_000).length;
        expect(naJanela).toBeLessThanOrEqual(porHora);
      }
      // E não fica parado à toa: em 6 h sai perto de 6 × porHora.
      expect(saidas.length).toBeGreaterThanOrEqual(6 * porHora - 1);
    }
  });

  it("mensagem de mais de 1 hora atrás não conta", () => {
    expect(proximaNoRitmo([minAtras(61), minAtras(70), minAtras(80), minAtras(90), minAtras(100)], agora, lim5)).toBeNull();
  });

  it("data inválida na lista não libera nem trava por engano", () => {
    expect(proximaNoRitmo([new Date("lixo")], agora, lim5)).toBeNull();
    expect(proximaNoRitmo([new Date("lixo"), minAtras(2)], agora, lim5)).not.toBeNull();
  });
});

describe("o padrão que não machuca", () => {
  it("ritmo zerado: nada sai", () => {
    expect(proximaNoRitmo([], agora, { ...LIMITES_PADRAO, porHora: 0 })).not.toBeNull();
  });

  it("ritmo negativo ou NaN: nada sai", () => {
    expect(proximaNoRitmo([], agora, { ...LIMITES_PADRAO, porHora: -3 })).not.toBeNull();
    expect(proximaNoRitmo([], agora, { ...LIMITES_PADRAO, porHora: Number.NaN })).not.toBeNull();
    expect(proximaNoRitmo([], agora, { ...LIMITES_PADRAO, porHora: Number.POSITIVE_INFINITY })).not.toBeNull();
  });

  it("explica em português, com a hora de Brasília", () => {
    const p = proximaNoRitmo([minAtras(5)], agora, lim5)!;
    expect(explicarRitmo(p, lim5)).toBe("Ritmo de 5 por hora: a próxima sai por volta das 10:07.");
    expect(explicarRitmo(p, { ...LIMITES_PADRAO, porHora: 0 })).toMatch(/zerado/);
  });
});

describe("quanto a lista leva — dito antes do clique", () => {
  it("40 clientes a 5/h = 8 horas", () => {
    expect(horasParaTerminar(40, lim5)).toBe(8);
    expect(descreverRitmo(40, lim5)).toBe("Sai no ritmo de 5 por hora (uma a cada 12 min), das 8h às 18h, em dias úteis. 40 clientes levam cerca de 8 horas de envio.");
  });

  it("lista que passa de um dia fala em dias (janela de 10 h × 5 = 50/dia, teto 80)", () => {
    expect(diasParaTerminar(120, lim5)).toBe(3);
    expect(descreverRitmo(120, lim5)).toMatch(/120 clientes levam cerca de 3 dias de envio\.$/);
  });

  it("o teto do dia manda quando é menor que o ritmo", () => {
    expect(diasParaTerminar(100, { ...lim5, porHora: 20, tetoDiario: 50 })).toBe(2);
  });

  it("singular certo", () => {
    expect(descreverRitmo(1, lim5)).toMatch(/1 cliente leva cerca de 1 hora de envio\.$/);
  });

  it("ritmo zerado diz que nada sai", () => {
    expect(descreverRitmo(10, { ...lim5, porHora: 0 })).toMatch(/zerado/);
  });
});

describe("Abrir no WhatsApp (o lugar do botão Enviar)", () => {
  it("monta o link com 55 + DDD + número e o texto codificado", () => {
    expect(linkWhatsApp("28999798168", "Bom dia João, tudo bem?")).toBe("https://wa.me/5528999798168?text=Bom%20dia%20Jo%C3%A3o%2C%20tudo%20bem%3F");
    expect(linkWhatsApp("(28) 99979-8168")).toBe("https://wa.me/5528999798168");
    expect(linkWhatsApp("5528999798168", "  ")).toBe("https://wa.me/5528999798168");
  });

  it("grupo, LID e número estranho não viram link (abriria a conversa de outra pessoa)", () => {
    expect(numeroParaWaMe("120363042123456789@g.us")).toBeNull();
    expect(numeroParaWaMe("123456789012345@lid")).toBeNull();
    expect(numeroParaWaMe("123456789012345")).toBeNull();
    expect(numeroParaWaMe("552899979816-1612345678")).toBeNull();
    expect(numeroParaWaMe("12345")).toBeNull();
    expect(numeroParaWaMe(null)).toBeNull();
    expect(numeroParaWaMe("")).toBeNull();
  });
});

// ── O CRM NÃO MANDA MENSAGEM DE CONVERSA ──────────────────────────────────
//
// O envio a cliente só pode sair por um destes arquivos. Caminho novo que
// importa sendText/sendImage… da zapi tem que entrar no funil
// (lib/envio-massa.ts) — ou entrar nesta lista com o motivo.
const PODE_ENVIAR: Record<string, string> = {
  "src/lib/envio-massa.ts": "o funil da campanha e do parabéns (pausa, janela, teto, ritmo)",
  "src/app/api/cron/whatsapp-retry/route.ts": "reenvio de falha da campanha (pausa, janela, teto, ritmo)",
  "src/lib/cerebro/relatorio-diario.ts": "resumo do dia para o número do PRÓPRIO vendedor",
  "src/app/api/cron/zeus-diario/route.ts": "briefing para o número do PRÓPRIO vendedor",
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("o CRM só espelha a conversa", () => {
  it("só os caminhos conhecidos chamam o envio da zapi", () => {
    const quemEnvia = arquivos("src")
      .filter((f) => f !== join("src", "lib", "zapi.ts"))
      .filter((f) => /\b(sendText|sendImage|sendImageBase64|sendAudio|sendAudioBase64|sendDocument|sendDocumentBase64|sendVideoBase64)\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.split("\\").join("/"));
    expect(quemEnvia.sort()).toEqual(Object.keys(PODE_ENVIAR).sort());
  });

  it("o funil não é server action (o navegador não pode chamar o envio direto)", () => {
    const src = readFileSync("src/lib/envio-massa.ts", "utf8");
    expect(src).not.toMatch(/^\s*["']use server["']/m);
  });

  it("as rotas de conversa recusam envio com 410 e dizem por quê", async () => {
    const rotas = [await import("@/app/api/conversations/[id]/messages/route"), await import("@/app/api/conversations/[id]/media/route")];
    for (const mod of rotas) {
      const r: Response = await mod.POST();
      expect(r.status).toBe(410);
      expect((await r.json()).erro).toMatch(/celular/);
    }
  });
});

// ── O FUNIL, COM BANCO E WHATSAPP DE MENTIRA ──────────────────────────────

const h = vi.hoisted(() => ({
  pausado: false,
  recentes: [] as Date[] | null,
  enviadas: 0,
  porHora: 5,
  enviados: [] as string[],
}));

vi.mock("@/lib/whatsapp-pausa", () => ({ envioPausado: async () => h.pausado }));
vi.mock("@/lib/envio-guarda", async () => {
  const { LIMITES_PADRAO } = await import("@/lib/envio-limites");
  return {
    lerLimitesEnvio: async () => ({ ...LIMITES_PADRAO, porHora: h.porHora, somenteDiasUteis: false, horaInicio: 0, horaFim: 24, pausaMinMs: 0, pausaMaxMs: 0 }),
    enviadasHoje: async () => h.enviadas,
    enviosDaUltimaHora: async () => (h.recentes ? [...h.recentes] : null),
    separarElegiveis: async (ids: string[]) => ({ liberados: ids, frios: [], pediramSaida: [], semTelefone: [] }),
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    cliente: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id, nome: `Cliente ${id}`, telefone: "28999990000" })),
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, nome: `Cliente ${where.id}`, telefone: "28999990000" }),
      update: async () => ({}),
    },
  },
}));
vi.mock("@/lib/zapi", () => ({
  isEnabled: () => true,
  EnvioNaoConfirmadoError: class extends Error {},
  sendText: async (phone: string) => { h.enviados.push(phone); return "id"; },
}));
vi.mock("@/lib/whatsapp-store", () => ({
  acharOuCriarConversa: async () => ({ conv: { id: "c1", externalPhone: "5528999990000" } }),
  inserirMensagem: async () => ({}),
}));
vi.mock("@/lib/audit", () => ({ registrarAudit: async () => {} }));
vi.mock("@/lib/midia-envio", () => ({ lerMidiaEnvio: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe("o funil da campanha (lib/envio-massa.ts)", () => {
  beforeEach(() => {
    h.pausado = false; h.recentes = []; h.enviadas = 0; h.porHora = 5; h.enviados = [];
  });

  it("hora vazia: manda UM e segura o segundo do lote pelo ritmo", async () => {
    const { enviarMensagemClientes } = await import("@/lib/envio-massa");
    const r = await enviarMensagemClientes(["a", "b"], "Oi {nome}", null);
    expect(r.enviados).toEqual(["a"]);
    expect(h.enviados).toHaveLength(1);
    expect(r.bloqueio).toMatch(/Ritmo de 5 por hora/);
  });

  it("anterior há 3 min: não manda nada e devolve bloqueio (não falha — o cursor não pode andar)", async () => {
    h.recentes = [new Date(Date.now() - 3 * 60_000)];
    const { enviarMensagemClientes } = await import("@/lib/envio-massa");
    const r = await enviarMensagemClientes(["a"], "Oi", null);
    expect(h.enviados).toHaveLength(0);
    expect(r.falhas).toHaveLength(0);
    expect(r.bloqueio).toMatch(/próxima sai/);
  });

  it("banco não diz quantas saíram: NÃO manda", async () => {
    h.recentes = null;
    const { enviarMensagemClientes } = await import("@/lib/envio-massa");
    const r = await enviarMensagemClientes(["a"], "Oi", null);
    expect(h.enviados).toHaveLength(0);
    expect(r.bloqueio).toMatch(/ritmo/);
  });

  it("pausa geral: nada sai", async () => {
    h.pausado = true;
    const { enviarMensagemClientes } = await import("@/lib/envio-massa");
    const r = await enviarMensagemClientes(["a"], "Oi", null);
    expect(h.enviados).toHaveLength(0);
    expect(r.bloqueio).toMatch(/PAUSADO/);
  });

  it("o parabéns automático também obedece a pausa (antes não obedecia)", async () => {
    h.pausado = true;
    const { enviarTextoAutomatico } = await import("@/lib/envio-massa");
    const r = await enviarTextoAutomatico("a", "Parabéns!", "aniversario");
    expect(r).toMatchObject({ ok: false, pausado: true });
    expect(h.enviados).toHaveLength(0);
  });

  it("ritmo zerado gravado: nada sai", async () => {
    h.porHora = 0;
    const { enviarMensagemClientes } = await import("@/lib/envio-massa");
    const r = await enviarMensagemClientes(["a"], "Oi", null);
    expect(h.enviados).toHaveLength(0);
    expect(r.bloqueio).toMatch(/zerado/);
  });
});
