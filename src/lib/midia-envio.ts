// Anexo/arte de uma mensagem em massa: guardado UMA vez no banco e lido por
// id em cada lote de envio (o navegador não reenvia megabytes por lote).
// Vive poucos dias — é material de campanha, não arquivo do cliente.

import { db } from "@/lib/db";
import type { TipoMidia } from "@/lib/mensagem-clientes-regra";

const VALIDADE_MS = 3 * 86_400_000;

export type MidiaGuardada = { id: string; mimeType: string; nome: string; tipo: TipoMidia; base64: string; origem: string };

export async function guardarMidiaEnvio(m: { base64: string; mimeType: string; nome: string; tipo: TipoMidia; origem: "upload" | "gemini" }): Promise<{ id: string }> {
  await db.midiaEnvio.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - VALIDADE_MS) } } }).catch(() => {});
  const row = await db.midiaEnvio.create({ data: m, select: { id: true } });
  return { id: row.id };
}

export async function lerMidiaEnvio(id: string): Promise<MidiaGuardada | null> {
  const row = await db.midiaEnvio.findUnique({ where: { id } });
  if (!row) return null;
  return { id: row.id, mimeType: row.mimeType, nome: row.nome, tipo: row.tipo as TipoMidia, base64: row.base64, origem: row.origem };
}
