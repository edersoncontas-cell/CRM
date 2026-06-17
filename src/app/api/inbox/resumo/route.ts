import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/inbox/resumo
// Snapshot leve de TODAS as conversas, para o polling global do inbox detectar:
// mensagens novas, novos contatos, mudança no "aguardando" e reordenar a lista.
export async function GET() {
  const clientes = await db.cliente.findMany({
    where: { conversas: { some: {} } },
    select: {
      id: true,
      nome: true,
      telefone: true,
      aguardandoResposta: true,
      ultimoContato: true,
      criadoEm: true,
      municipio: { select: { nome: true } },
      conversas: {
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { id: true, conteudo: true, criadoEm: true, remetente: true },
      },
      _count: { select: { conversas: true } },
    },
  });

  const resumo = clientes
    .map((c) => {
      const ultima = c.conversas[0];
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        municipio: c.municipio?.nome ?? null,
        aguardando: c.aguardandoResposta,
        ultimoContato: (c.ultimoContato ?? ultima?.criadoEm ?? c.criadoEm).toISOString(),
        previa: ultima?.conteudo ?? "",
        ultimaMsgId: ultima?.id ?? null,
        ultimaMsgRemetente: ultima?.remetente ?? null,
        totalMensagens: c._count.conversas,
      };
    })
    .sort((a, b) => +new Date(b.ultimoContato) - +new Date(a.ultimoContato));

  return NextResponse.json(
    { resumo, agora: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
