import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

// GET /api/inbox?clienteId=xxx&after=<iso-timestamp>
// Returns new messages for a client since the given timestamp.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clienteId = searchParams.get("clienteId");
  const after = searchParams.get("after");

  if (!clienteId) {
    return NextResponse.json({ erro: "clienteId obrigatório" }, { status: 400 });
  }

  const afterDate = after ? new Date(after) : new Date(0);

  const conversas = await db.conversa.findMany({
    where: {
      clienteId,
      criadoEm: { gt: afterDate },
    },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      conteudo: true,
      remetente: true,
      tipo: true,
      criadoEm: true,
    },
  });

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { aguardandoResposta: true },
  });

  return NextResponse.json({
    mensagens: conversas.map((m) => ({
      id: m.id,
      conteudo: m.conteudo,
      remetente: m.remetente,
      tipo: m.tipo,
      criadoEm: m.criadoEm.toISOString(),
    })),
    aguardando: cliente?.aguardandoResposta ?? false,
  });
}
