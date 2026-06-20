import { db } from "@/lib/db";

// Configurações do WhatsApp (singleton). auditMode=true → IA gera rascunho.
export async function getWaSettings() {
  let s = await db.whatsAppSettings.findFirst();
  if (!s) s = await db.whatsAppSettings.create({ data: {} });
  return s;
}

export function cronAutorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem secret → liberado
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
