import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { zapiPost, resolveZApiConfig } from "@/lib/zapi";

export const dynamic = "force-dynamic";

const CATEGORIAS = ["CLIENTE", "LEAD", "GRUPO", "OUTRO"];

// Atualiza ajustes da conversa: IA ligada, marcado como respondido, categoria, status, nome do contato.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.aiActive === "boolean") data.aiActive = body.aiActive;
  if (typeof body.encerrada === "boolean") data.encerrada = body.encerrada;
  if (typeof body.category === "string" && CATEGORIAS.includes(body.category)) {
    data.category = body.category;
    data.categoryConfirmed = true;
  }
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.contactName === "string" && body.contactName.trim()) {
    data.contactName = body.contactName.trim();
  }
  if (typeof body.clienteId === "string" && body.clienteId) data.clienteId = body.clienteId;

  // "Atendimento encerrado": o cliente vinculado deixa de contar como
  // aguardando resposta (some das listas/contadores de pendência do CRM).
  const encerrarAtendimento = body.encerrarAtendimento === true;

  if (!Object.keys(data).length && !encerrarAtendimento) {
    return NextResponse.json({ ok: false, erro: "nada a atualizar" }, { status: 400 });
  }

  const conv = Object.keys(data).length
    ? await db.whatsAppConversation.update({ where: { id: params.id }, data })
    : await db.whatsAppConversation.findUnique({ where: { id: params.id } });

  if (!conv) return NextResponse.json({ ok: false, erro: "conversa não encontrada" }, { status: 404 });

  // Sincroniza o nome no cadastro do cliente vinculado — só quando o front
  // manda a flag explícita (checkbox "Atualizar também o cadastro"), para não
  // sobrescrever o nome do Cliente sem confirmação a cada rename de contato.
  if (data.contactName && conv.clienteId && body.syncCliente === true) {
    await db.cliente.update({ where: { id: conv.clienteId }, data: { nome: data.contactName as string } }).catch(() => {});
  }

  if (encerrarAtendimento && conv.clienteId) {
    await db.cliente.update({ where: { id: conv.clienteId }, data: { aguardandoResposta: false } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, conversation: conv });
}

// Exclui a conversa e todas as suas mensagens (cascade no schema).
// Tambem remove o chat no Z-API para manter sincronizado com o WhatsApp.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Busca os dados da conversa antes de excluir (precisa do phone para deletar no Z-API)
    const conv = await db.whatsAppConversation.findUnique({
      where: { id: params.id },
      select: { id: true, externalPhone: true, lid: true, isGroup: true },
    });

    if (!conv) {
      return NextResponse.json({ ok: false, erro: "conversa nao encontrada" }, { status: 404 });
    }

    // 2. Exclui do banco (cascade apaga as mensagens tambem)
    await db.whatsAppConversation.delete({ where: { id: params.id } });

    // 3. Tenta deletar o chat no Z-API (best-effort, nao falha se der erro)
    // O phone para o Z-API pode ser o externalPhone ou o lid
    const zapiCfg = await resolveZApiConfig().catch(() => null);
    if (zapiCfg) {
      const phoneParaZapi = conv.isGroup
        ? conv.externalPhone
        : (conv.externalPhone.replace(/\D/g, "") || conv.externalPhone);

      // Tenta com o phone principal
      zapiPost("modify-chat", { phone: phoneParaZapi, action: "delete" }).catch(() => {
        // Se falhar com phone, tenta com o LID (quando phone e um LID de 14-15 digitos)
        if (conv.lid) {
          zapiPost("modify-chat", { phone: conv.lid, action: "delete" }).catch(() => {});
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, erro: "conversa nao encontrada" }, { status: 404 });
  }
}
