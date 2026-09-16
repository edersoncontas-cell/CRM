import { NextRequest, NextResponse } from "next/server";
import { validateWebhook, expectedZApiInstanceId } from "@/lib/zapi";
import { isAllowedInstance, extractLid, extractContent, isGroupChatId } from "@/lib/whatsapp-routing";
import { atualizarStatusEntrega } from "@/lib/whatsapp-store";
import { registrarDiag } from "@/lib/zapi-diag";
import { processarEventoMensagem } from "@/lib/whatsapp-inbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Webhook da Z-API. Só valida/normaliza o payload — toda a lógica comum
// (eco, vínculo de cliente, pipeline, Orientador) vive em lib/whatsapp-inbound.ts,
// compartilhada com o webhook da Evolution API.

// GET de teste no navegador.
export async function GET() {
  return NextResponse.json({ status: "webhook ativo", instancia: expectedZApiInstanceId() ? "configurada" : "—" });
}

const STATUS_MAP: Record<string, string> = { SENT: "SENT", RECEIVED: "DELIVERED", READ: "READ", PLAYED: "READ" };

export async function POST(req: NextRequest) {
  // 1. validação (nunca usa o token de ENVIO)
  if (!validateWebhook(req.headers.get("client-token"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // 3. isolamento de instância
  if (!isAllowedInstance(body?.instanceId, expectedZApiInstanceId())) {
    return NextResponse.json({ ignorado: "incompatibilidade de instâncias" });
  }

  // 4. retornos de chamada de status de entrega
  const tipo = String(body?.type ?? "");
  if (tipo === "MessageStatusCallback" || tipo === "DeliveryCallback") {
    const novo = STATUS_MAP[String(body?.status ?? "").toUpperCase()];
    const ids: string[] = Array.isArray(body?.ids) ? (body.ids as unknown[]).map(String)
      : body?.messageId ? [String(body.messageId)] : [];
    if (novo && ids.length) {
      try { await atualizarStatusEntrega(ids, novo); }
      catch (e) { console.error("[wa webhook] erro de status:", e); return NextResponse.json({ ok: false }, { status: 500 }); }
    }
    return NextResponse.json({ ok: true });
  }

  const phoneRaw = body?.phone ? String(body.phone) : null;
  const fromMe = body?.fromMe === true;
  const isGroup = body?.isGroup === true || (phoneRaw ? isGroupChatId(phoneRaw) : false);

  // Quando fromMe=true, o senderName é o nome do OPERADOR (você), não do
  // contato. Nunca usar senderName de mensagens fromMe como nome do contato.
  const nomeRecebido = !fromMe ? ((body?.senderName as string) ?? (body?.chatName as string) ?? null) : null;
  const nomeGrupo = isGroup ? ((body?.senderName as string) ?? (body?.chatName as string) ?? null) : null;

  // A Z-API manda a foto do contato/grupo direto no payload — aproveitamos sem custo.
  const foto = (body?.photo as string) ?? (body?.senderPhoto as string) ?? (body?.chatImage as string) ?? null;

  console.log("[webhook wa]", JSON.stringify({ type: body?.type, fromMe, phone: phoneRaw, isGroup }));

  if (!phoneRaw) {
    await registrarDiag({ dir: fromMe ? "out" : "in", phone: null, nome: nomeRecebido, texto: "", status: "sem-telefone" });
    return NextResponse.json({ ok: true });
  }

  const conteudo = extractContent(body);
  const tampa = extractLid(body);
  const telefone = isGroup ? phoneRaw : (phoneRaw.includes("@") ? phoneRaw.split("@")[0] : phoneRaw).replace(/\D/g, "") || phoneRaw;
  const zapiMessageId = body?.messageId ? String(body.messageId) : null;
  const tsRaw = Number(body?.momment ?? body?.moment ?? 0) || 0;
  const sentAt = tsRaw ? new Date(tsRaw < 1e12 ? tsRaw * 1000 : tsRaw) : null;

  const r = await processarEventoMensagem({
    fromMe, phone: telefone, lid: tampa, isGroup,
    nomeContato: nomeRecebido, nomeGrupo, foto, conteudo, messageId: zapiMessageId, sentAt,
  });
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : 500 });
}
