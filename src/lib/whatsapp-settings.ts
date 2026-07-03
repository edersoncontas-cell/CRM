import { db } from "@/lib/db";

// Configurações do WhatsApp (singleton). auditMode=true → IA gera rascunho.
export async function getWaSettings() {
  let s = await db.whatsAppSettings.findFirst();
  if (!s) s = await db.whatsAppSettings.create({ data: {} });
  return s;
}

// A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente quando
// a env var existe. Sem CRON_SECRET configurado, os crons ficam abertos ao
// público em dev (conveniência local), mas negados em produção (fail-closed).
export function cronAutorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}
