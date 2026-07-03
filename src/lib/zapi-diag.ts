// Diagnóstico do webhook da Z-API: registra cada chamada recebida e o resultado,
// para vermos na página de Conexão se a Z-API está mesmo chamando o CRM e onde trava.

import { db } from "@/lib/db";

const CHAVE = "zapi_diag";
const CHAVE_TOTAL = "zapi_diag_total";

export type EventoDiag = {
  em: string;
  dir: "in" | "out" | "-";
  phone: string | null;
  nome: string | null;
  texto: string;
  status: string; // recebida | enviada | grupo | status | sem-telefone | sem-texto | erro:...
};

export type Diag = {
  totalChamadas: number;
  ultimaChamada: string | null;
  ultimos: EventoDiag[];
};

export async function registrarDiag(e: Omit<EventoDiag, "em">): Promise<void> {
  try {
    // totalChamadas em linha própria, incrementado com UPSERT atômico (uma só
    // instrução SQL) — não se perde em corrida de webhooks concorrentes, ao
    // contrário do read-modify-write abaixo. O rolling log de "ultimos" (só
    // exibição de diagnóstico, não afeta nada funcional) segue tolerando a
    // corrida ocasional — construir uma tabela de eventos própria fica para o
    // ZEUS (Fase 4).
    await db.$executeRaw`
      INSERT INTO "Configuracao" (chave, valor) VALUES (${CHAVE_TOTAL}, '1')
      ON CONFLICT (chave) DO UPDATE SET valor = (CAST("Configuracao".valor AS INTEGER) + 1)::text
    `;

    const cfg = await db.configuracao.findUnique({ where: { chave: CHAVE } });
    let d: Diag = { totalChamadas: 0, ultimaChamada: null, ultimos: [] };
    if (cfg?.valor) { try { d = JSON.parse(cfg.valor); } catch {} }
    const agora = new Date().toISOString();
    d.ultimaChamada = agora;
    const evento: EventoDiag = { em: agora, ...e, texto: (e.texto ?? "").slice(0, 90) };
    d.ultimos = [evento, ...(d.ultimos || [])].slice(0, 12);
    await db.configuracao.upsert({
      where: { chave: CHAVE },
      update: { valor: JSON.stringify(d) },
      create: { chave: CHAVE, valor: JSON.stringify(d) },
    });
  } catch {
    // diagnóstico nunca pode quebrar o webhook
  }
}

export async function lerDiag(): Promise<Diag> {
  const [cfg, cfgTotal] = await Promise.all([
    db.configuracao.findUnique({ where: { chave: CHAVE } }),
    db.configuracao.findUnique({ where: { chave: CHAVE_TOTAL } }),
  ]);
  const totalChamadas = cfgTotal?.valor ? parseInt(cfgTotal.valor, 10) || 0 : 0;
  if (!cfg?.valor) return { totalChamadas, ultimaChamada: null, ultimos: [] };
  try {
    const d = JSON.parse(cfg.valor) as Diag;
    return { ...d, totalChamadas };
  } catch {
    return { totalChamadas, ultimaChamada: null, ultimos: [] };
  }
}
