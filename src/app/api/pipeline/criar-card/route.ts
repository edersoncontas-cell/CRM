import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ESTAGIO_INICIAL } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

// POST /api/pipeline/criar-card
// Cria um card de negociação no pipeline para o cliente vinculado à conversa.
export async function POST(req: NextRequest) {
  const { clienteId, estagio } = await req.json().catch(() => ({}));
  if (!clienteId) return NextResponse.json({ ok: false, erro: "clienteId obrigatório" }, { status: 400 });

  // Verifica se já tem negociação aberta
  const existente = await db.negociacao.findFirst({
    where: { clienteId, status: "aberta" },
  });
  if (existente) {
    return NextResponse.json({ ok: true, id: existente.id, ja_existia: true });
  }

  const nova = await db.negociacao.create({
    data: {
      clienteId,
      estagio: estagio ?? ESTAGIO_INICIAL,
      ultimoContato: new Date(),
    },
  });

  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, id: nova.id });
}
