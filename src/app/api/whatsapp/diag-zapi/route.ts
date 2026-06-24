import { NextResponse } from "next/server";
import { resolveZApiConfig } from "@/lib/zapi";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cfg = await resolveZApiConfig();
  if (!cfg) return NextResponse.json({ erro: "Z-API não configurada" });

  // Busca 5 páginas de chats (até 500 contatos)
  const allChats: Array<{ phone: string; lid?: string; name?: string; isGroup: boolean }> = [];
  for (let page = 1; page <= 5; page++) {
    try {
      const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/chats?page=${page}&pageSize=100`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(cfg.clientToken ? { "Client-Token": cfg.clientToken } : {}) },
        cache: "no-store",
      });
      if (!res.ok) break;
      const data = await res.json().catch(() => null);
      if (!Array.isArray(data) || data.length === 0) break;
      for (const c of data) {
        allChats.push({
          phone: String(c.phone ?? ""),
          lid: c.lid ? String(c.lid).replace("@lid", "") : undefined,
          name: c.name ?? c.chatName ?? undefined,
          isGroup: !!c.isGroup,
        });
      }
      if (data.length < 100) break;
    } catch { break; }
  }

  // Busca conversas sem nome do DB
  const semNome = await db.whatsAppConversation.findMany({
    where: { isGroup: false, contactName: null },
    select: { id: true, externalPhone: true, lid: true },
  });

  // Cruza: tenta casar pelo phone ou lid
  const resultados = semNome.map((conv) => {
    const phoneNorm = conv.externalPhone.replace(/\D/g, "");
    const lidNorm = conv.lid?.replace("@lid", "").replace(/\D/g, "");

    const match = allChats.find((c) => {
      const cp = c.phone.replace(/\D/g, "");
      const cl = c.lid?.replace(/\D/g, "");
      return cp === phoneNorm || (lidNorm && cl === lidNorm) || (lidNorm && cp === lidNorm);
    });

    return {
      dbPhone: conv.externalPhone,
      dbLid: conv.lid,
      zapiMatch: match ? { phone: match.phone, lid: match.lid, name: match.name } : null,
    };
  });

  return NextResponse.json({
    totalChatsZapi: allChats.length,
    totalSemNomeDB: semNome.length,
    cruzamento: resultados,
  });
}
