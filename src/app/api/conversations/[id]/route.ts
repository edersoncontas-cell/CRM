import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const CATEGORIAS = ["CLIENTE", "LEAD", "GRUPO", "OUTRO"];

// Atualiza ajustes da conversa: Agnes (IA) ligada, ignorar, categoria, status.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.aiActive === "boolean") data.aiActive = body.aiActive;
  if (typeof body.ignored === "boolean") data.ignored = body.ignored;
  if (typeof body.category === "string" && CATEGORIAS.includes(body.category)) {
    data.category = body.category;
    data.categoryConfirmed = true;
  }
  if (typeof body.status === "string") data.status = body.status;

  if (!Object.keys(data).length) return NextResponse.json({ ok: false, erro: "nada a atualizar" }, { status: 400 });

  const conv = await db.whatsAppConversation.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, conversation: conv });
}

// Exclui a conversa e todas as suas mensagens (cascade no schema).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.whatsAppConversation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, erro: "conversa não encontrada" }, { status: 404 });
  }
}
