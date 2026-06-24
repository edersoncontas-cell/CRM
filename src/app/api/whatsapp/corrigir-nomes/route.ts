import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Retorna true se a string parece ser um número de telefone (só dígitos, +, -, espaços, parênteses).
 */
function pareceNumeroTelefone(s: string): boolean {
  if (!s) return false;
  const stripped = s.replace(/[\s+\-().@]/g, "").replace(/@.*$/, "");
  return /^\d{6,}$/.test(stripped);
}

/**
 * POST /api/whatsapp/corrigir-nomes
 * Varre todas as conversas cujo contactName parece número de telefone
 * e tenta substituir pelo nome do cliente vinculado no CRM.
 * Se não houver cliente vinculado, limpa o contactName (null) para
 * que a UI mostre o número formatado em vez de um número bagunçado.
 */
export async function POST() {
  try {
    // Busca todas as conversas com contactName que pareça número
    const conversas = await db.whatsAppConversation.findMany({
      where: {
        isGroup: false,
        contactName: { not: null },
      },
      select: {
        id: true,
        contactName: true,
        externalPhone: true,
        clienteId: true,
      },
    });

    // Filtra apenas as que têm contactName parecendo número
    const paraCorrigir = conversas.filter(
      (c) => c.contactName && pareceNumeroTelefone(c.contactName)
    );

    let corrigidos = 0;
    let limpos = 0;

    for (const conv of paraCorrigir) {
      if (conv.clienteId) {
        // Tem cliente vinculado — busca o nome do cliente
        const cliente = await db.cliente.findUnique({
          where: { id: conv.clienteId },
          select: { nome: true },
        });
        if (cliente?.nome && !pareceNumeroTelefone(cliente.nome)) {
          await db.whatsAppConversation.update({
            where: { id: conv.id },
            data: { contactName: cliente.nome },
          });
          corrigidos++;
          continue;
        }
      }

      // Sem cliente ou nome do cliente também é número → limpa para null
      // (UI vai mostrar o externalPhone formatado)
      await db.whatsAppConversation.update({
        where: { id: conv.id },
        data: { contactName: null },
      });
      limpos++;
    }

    return NextResponse.json({
      ok: true,
      total: paraCorrigir.length,
      corrigidos,
      limpos,
      mensagem: `${paraCorrigir.length} conversas com nomes como número: ${corrigidos} corrigidas com nome do CRM, ${limpos} limpas.`,
    });
  } catch (e) {
    console.error("[corrigir-nomes]", e);
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}

/**
 * GET /api/whatsapp/corrigir-nomes
 * Apenas informa quantas conversas têm o problema (sem corrigir).
 */
export async function GET() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false, contactName: { not: null } },
      select: { id: true, contactName: true, externalPhone: true },
    });
    const comProblema = conversas.filter(
      (c) => c.contactName && pareceNumeroTelefone(c.contactName)
    );
    return NextResponse.json({
      ok: true,
      total: conversas.length,
      comProblema: comProblema.length,
      exemplos: comProblema.slice(0, 5).map((c) => ({
        phone: c.externalPhone,
        contactNameAtual: c.contactName,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
