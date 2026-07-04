// Estado operacional do ZEUS (Fase 4): kill-switch, heartbeats dos crons e
// orçamento diário de chamadas de IA. Tudo guardado em `Configuracao`
// (chave/valor), sem tabela nova — o CRM já usa esse padrão para flags simples.

import { db } from "@/lib/db";

const CHAVE_ATIVO = "zeus.ativo";
const CHAVE_ORCAMENTO_PREFIXO = "zeus.ia_usada."; // + YYYY-MM-DD

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Kill-switch global: desligado por padrão só se alguém desligar explicitamente
// (chave ausente = ligado, comportamento seguro/conveniente por padrão).
export async function zeusAtivo(): Promise<boolean> {
  const c = await db.configuracao.findUnique({ where: { chave: CHAVE_ATIVO } });
  return c?.valor !== "off";
}

export async function definirZeusAtivo(ativo: boolean): Promise<void> {
  await db.configuracao.upsert({
    where: { chave: CHAVE_ATIVO },
    update: { valor: ativo ? "on" : "off" },
    create: { chave: CHAVE_ATIVO, valor: ativo ? "on" : "off" },
  });
}

// ── Heartbeats: cada cron toca o dele a cada execução; o tick confere se
// algum ficou "quieto" além do esperado (sinal de que parou de rodar). ─────
export async function tocarHeartbeat(nome: string): Promise<void> {
  await db.configuracao.upsert({
    where: { chave: `heartbeat.${nome}` },
    update: { valor: new Date().toISOString() },
    create: { chave: `heartbeat.${nome}`, valor: new Date().toISOString() },
  }).catch(() => {});
}

export async function ultimoHeartbeat(nome: string): Promise<Date | null> {
  const c = await db.configuracao.findUnique({ where: { chave: `heartbeat.${nome}` } });
  return c?.valor ? new Date(c.valor) : null;
}

// ── Orçamento diário de chamadas de IA "extras" do ZEUS (diagnóstico de bugs
// repetidos, briefing diário) — não conta as chamadas do pipeline/Cérebro,
// que já têm seu próprio custo justificado por uma ação direta do usuário. ──
const ORCAMENTO_PADRAO = Number(process.env.ZEUS_ORCAMENTO_IA_DIARIO || "50");

export async function orcamentoIADisponivel(): Promise<boolean> {
  const chave = CHAVE_ORCAMENTO_PREFIXO + hojeISO();
  const c = await db.configuracao.findUnique({ where: { chave } });
  const usado = c?.valor ? parseInt(c.valor, 10) || 0 : 0;
  return usado < ORCAMENTO_PADRAO;
}

export async function consumirOrcamentoIA(): Promise<void> {
  const chave = CHAVE_ORCAMENTO_PREFIXO + hojeISO();
  await db.$executeRaw`
    INSERT INTO "Configuracao" (chave, valor) VALUES (${chave}, '1')
    ON CONFLICT (chave) DO UPDATE SET valor = (CAST("Configuracao".valor AS INTEGER) + 1)::text
  `;
}
