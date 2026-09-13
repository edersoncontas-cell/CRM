import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveZApiConfig } from "@/lib/zapi";

export const dynamic = "force-dynamic";

/**
 * GET /api/whatsapp/sincronizar
 * Busca os chats ativos no Z-API e remove do DB as conversas que nao existem mais.
 * Util quando o usuario apaga conversas no celular ou no WhatsApp Web.
 */
export async function GET() {
  const cfg = await resolveZApiConfig();
  if (!cfg) {
    return NextResponse.json({
      ok: false,
      erro: "A sincronização de chats apagados usa um recurso exclusivo da Z-API. Com a Evolution API, apague a conversa direto no CRM (menu da conversa em /atendimento).",
    }, { status: 503 });
  }

  // 1. Busca ate 2000 chats do Z-API (20 paginas x 100)
  const zapiPhones = new Set<string>();
  const zapiLids = new Set<string>();

  for (let page = 1; page <= 20; page++) {
    const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/chats?page=${page}&pageSize=100`;
    const res = await fetch(url, {
      headers: cfg.clientToken ? { "Client-Token": cfg.clientToken } : {},
      cache: "no-store",
    }).catch(() => null);
    if (!res?.ok) break;
    const data: unknown = await res.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) break;

    for (const c of data as Record<string, unknown>[]) {
      const phone = String(c.phone ?? c.id ?? "").replace(/\D/g, "");
      if (phone) zapiPhones.add(phone);

      // Extrai LID se disponivel
      const lid = c.lid ? String(c.lid).replace(/\D/g, "") : null;
      if (lid) zapiLids.add(lid);
    }
  }

  if (zapiPhones.size === 0) {
    return NextResponse.json({ ok: false, erro: "Z-API nao retornou chats (talvez desconectado)" });
  }

  // 2. Busca todas as conversas nao-grupo do DB
  const conversasDB = await db.whatsAppConversation.findMany({
    where: { isGroup: false },
    select: { id: true, externalPhone: true, lid: true, contactName: true },
  });

  // 3. Para cada conversa do DB, verifica se existe no Z-API
  const excluir: string[] = [];

  for (const conv of conversasDB) {
    const phoneDb = conv.externalPhone.replace(/\D/g, "");
    const lidDb = conv.lid ? String(conv.lid).replace(/\D/g, "") : null;

    // Verifica por phone direto
    const achouPorPhone = zapiPhones.has(phoneDb);

    // Verifica por LID (ultimos digitos do phone do DB podem ser o LID)
    const achouPorLid = lidDb ? zapiLids.has(lidDb) || zapiPhones.has(lidDb) : false;

    // Verifica se o phoneDb (que pode ser um LID) existe nos LIDs do Z-API
    const phoneDbNosLids = zapiLids.has(phoneDb);

    if (!achouPorPhone && !achouPorLid && !phoneDbNosLids) {
      excluir.push(conv.id);
    }
  }

  // 4. Remove do DB (em lotes de 50 para nao sobrecarregar)
  let removidos = 0;
  for (let i = 0; i < excluir.length; i += 50) {
    const lote = excluir.slice(i, i + 50);
    const res = await db.whatsAppConversation.deleteMany({ where: { id: { in: lote } } });
    removidos += res.count;
  }

  return NextResponse.json({
    ok: true,
    zapiChats: zapiPhones.size,
    conversasDB: conversasDB.length,
    removidos,
    mensagem: removidos > 0
      ? `${removidos} conversa(s) removida(s) do CRM pois nao existem mais no WhatsApp.`
      : "Tudo sincronizado! Nenhuma conversa para remover.",
  });
}
