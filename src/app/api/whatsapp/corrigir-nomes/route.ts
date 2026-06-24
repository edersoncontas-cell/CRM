import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";

export const dynamic = "force-dynamic";

/**
 * Retorna true se a string parece ser um número de telefone.
 */
function pareceNumeroTelefone(s: string): boolean {
  if (!s) return false;
  const stripped = s.replace(/[\s+\-().@]/g, "").replace(/@.*$/, "");
  return /^\d{6,}$/.test(stripped);
}

/**
 * POST /api/whatsapp/corrigir-nomes
 * Faz dois tipos de correção:
 * 1. Conversas cujo contactName parece número → limpa ou substitui pelo nome do CRM
 * 2. Conversas com contactName null/vazio → tenta preencher pelo nome do cliente vinculado
 *    ou buscando pelo telefone nos clientes do CRM
 */
export async function POST() {
  try {
    // Busca TODAS as conversas individuais (não grupos)
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: {
        id: true,
        contactName: true,
        externalPhone: true,
        clienteId: true,
      },
    });

    let corrigidos = 0;
    let vinculados = 0;
    let semNome = 0;

    for (const conv of conversas) {
      const nomeAtual = conv.contactName;

      // Verifica se precisa de correção:
      // - null/vazio, OU
      // - parece número de telefone
      const precisaCorrigir = !nomeAtual || !nomeAtual.trim() || pareceNumeroTelefone(nomeAtual);
      if (!precisaCorrigir) continue;

      let nomeNovo: string | null = null;

      // 1. Tenta pelo clienteId vinculado
      if (conv.clienteId) {
        const cliente = await db.cliente.findUnique({
          where: { id: conv.clienteId },
          select: { nome: true },
        });
        if (cliente?.nome && !pareceNumeroTelefone(cliente.nome)) {
          nomeNovo = cliente.nome;
        }
      }

      // 2. Se não achou pelo clienteId, busca pelo telefone no CRM
      if (!nomeNovo) {
        const variants = phoneLookupVariants(conv.externalPhone);
        if (variants.length > 0) {
          const cliente = await db.cliente.findFirst({
            where: { telefone: { in: variants } },
            select: { id: true, nome: true },
          });
          if (cliente?.nome && !pareceNumeroTelefone(cliente.nome)) {
            nomeNovo = cliente.nome;
            // Aproveita para vincular o clienteId se ainda não estava vinculado
            if (!conv.clienteId) {
              await db.whatsAppConversation.update({
                where: { id: conv.id },
                data: { contactName: nomeNovo, clienteId: cliente.id },
              });
              vinculados++;
              continue;
            }
          }
        }
      }

      if (nomeNovo) {
        await db.whatsAppConversation.update({
          where: { id: conv.id },
          data: { contactName: nomeNovo },
        });
        if (pareceNumeroTelefone(nomeAtual ?? "")) corrigidos++;
        else vinculados++;
      } else {
        // Não achou nome — deixa null (UI mostra o telefone formatado)
        if (nomeAtual && pareceNumeroTelefone(nomeAtual)) {
          await db.whatsAppConversation.update({
            where: { id: conv.id },
            data: { contactName: null },
          });
          semNome++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      corrigidos,
      vinculados,
      semNome,
      mensagem: `${corrigidos + vinculados + semNome} conversas atualizadas: ${corrigidos} nomes-número corrigidos, ${vinculados} vinculados ao CRM, ${semNome} limpos.`,
    });
  } catch (e) {
    console.error("[corrigir-nomes]", e);
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}

/**
 * GET /api/whatsapp/corrigir-nomes
 * Mostra diagnóstico: quantas conversas sem nome e quantas com nome-número.
 */
export async function GET() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: { id: true, contactName: true, externalPhone: true, clienteId: true },
    });
    const semNome = conversas.filter((c) => !c.contactName || !c.contactName.trim());
    const nomeNumero = conversas.filter((c) => c.contactName && pareceNumeroTelefone(c.contactName));

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      semNome: semNome.length,
      nomeNumero: nomeNumero.length,
      exemplos: [...nomeNumero, ...semNome.filter((c) => !nomeNumero.find((n) => n.id === c.id))]
        .slice(0, 8)
        .map((c) => ({ phone: c.externalPhone, contactName: c.contactName, clienteId: c.clienteId })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
