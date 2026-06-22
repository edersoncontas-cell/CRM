import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/fix-names
 * Corrige conversas onde contactName foi sobrescrito com o nome do operador.
 * 
 * Uso: acesse esta URL no navegador enquanto logado no CRM.
 * Parâmetros opcionais:
 *   ?names=Edy,New Holland,outro (nomes a corrigir, separados por vírgula)
 *   ?dry=1 (apenas mostra o que seria corrigido, sem alterar)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  
  // Nomes do operador que nunca devem aparecer como nome de contato
  const customNames = url.searchParams.get("names");
  const operatorNames = customNames
    ? customNames.split(",").map(n => n.trim()).filter(Boolean)
    : ["Edy - New Holland", "Edy", "New Holland", "Edy New Holland", "EDY - NEW HOLLAND"];

  // Busca conversas com nome do operador
  const affected = await db.whatsAppConversation.findMany({
    where: {
      contactName: { in: operatorNames },
      isGroup: false, // só conversas individuais
    },
    select: {
      id: true,
      externalPhone: true,
      contactName: true,
      lastMessageAt: true,
    },
    orderBy: { lastMessageAt: "desc" },
  });

  if (dry || affected.length === 0) {
    return NextResponse.json({
      ok: true,
      dry,
      found: affected.length,
      conversas: affected,
      message: dry
        ? `Modo simulação: ${affected.length} conversa(s) seriam corrigidas.`
        : "Nenhuma conversa com nome do operador encontrada.",
    });
  }

  // Corrige: define contactName como null para ser repopulado pelo próximo evento Z-API
  const ids = affected.map(c => c.id);
  const { count } = await db.whatsAppConversation.updateMany({
    where: { id: { in: ids } },
    data: { contactName: null },
  });

  return NextResponse.json({
    ok: true,
    corrigidas: count,
    conversas: affected.map(c => ({ ...c, novoNome: null })),
    message: `✅ ${count} conversa(s) corrigidas. O nome correto será restaurado na próxima mensagem recebida.`,
  });
}
