// Diagnóstico do webhook da Z-API: registra cada chamada recebida e o resultado,
// para vermos na página de Conexão se a Z-API está mesmo chamando o CRM e onde trava.

import { db } from "@/lib/db";

const CHAVE = "zapi_diag";

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
    const cfg = await db.configuracao.findUnique({ where: { chave: CHAVE } });
    let d: Diag = { totalChamadas: 0, ultimaChamada: null, ultimos: [] };
    if (cfg?.valor) { try { d = JSON.parse(cfg.valor); } catch {} }
    const agora = new Date().toISOString();
    d.totalChamadas = (d.totalChamadas || 0) + 1;
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
  const cfg = await db.configuracao.findUnique({ where: { chave: CHAVE } });
  if (!cfg?.valor) return { totalChamadas: 0, ultimaChamada: null, ultimos: [] };
  try { return JSON.parse(cfg.valor); } catch { return { totalChamadas: 0, ultimaChamada: null, ultimos: [] }; }
}
