import { NextRequest, NextResponse } from "next/server";
import { validateWebhook, expectedZApiInstanceId } from "@/lib/zapi";
import { isAllowedInstance, extractLid, extractContent, isGroupChatId } from "@/lib/whatsapp-routing";
import {
    acharOuCriarConversa, inserirMensagem, existeZapiId, acharEcoRecente, atualizarStatusEntrega, curarZapiId,
} from "@/lib/whatsapp-store";
import { registrarDiag } from "@/lib/zapi-diag";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // CORREÇÃO: quando fromMe=true, o senderName é o nome do OPERADOR (você),
  // não do contato. Nunca usar senderName de mensagens fromMe como nome do contato.
  // Só usar o nome quando a mensagem é RECEBIDA (fromMe=false) ou quando for nome do grupo.
  const nomeRecebido = !fromMe ? ((body?.senderName as string) ?? (body?.chatName as string) ?? null) : null;
    const nomeGrupo = isGroup ? ((body?.senderName as string) ?? (body?.chatName as string) ?? null) : null;

  // A Z-API manda a foto do contato/grupo direto no payload — aproveitamos sem custo.
  const foto = (body?.photo as string) ?? (body?.senderPhoto as string) ?? (body?.chatImage as string) ?? null;

  let diag = { dir: fromMe ? "out" as const : "in" as const, phone: phoneRaw, nome: nomeRecebido, text: "", status: "?" };

  console.log("[webhook wa]", JSON.stringify({ type: body?.type, fromMe, phone: phoneRaw, isGroup }));

  if (!phoneRaw) { diag.status = "sem-telefone"; await registrarDiag(diag); return NextResponse.json({ ok: true }); }

  // 7/8. conteúdo (texto + mídia)
  const c = extractContent(body);
    diag.text = c.text;
    if (!c.text) { diag.status = "sem-texto"; await registrarDiag(diag); return NextResponse.json({ ok: true }); }

  // 9. telefone + tampa
  const tampa = extractLid(body);
    const telefone = isGroup ? phoneRaw : (phoneRaw.includes("@") ? phoneRaw.split("@")[0] : phoneRaw).replace(/\D/g, "") || phoneRaw;
    const zapiMessageId = body?.messageId ? String(body.messageId) : null;

  try {
        if (fromMe) {
                // ── Ramo fromMe (anti-eco em 2 camadas) ──
          // Não atualizamos o nome do contato quando fromMe=true (seria o nome do operador)
          if (await existeZapiId(zapiMessageId)) { diag.status = "eco"; await registrarDiag(diag); return NextResponse.json({ ok: true }); }
                const { conv } = await acharOuCriarConversa({
                          telefone, tampa, isGroup,
                          // fromMe: não passar nome de contato (seria o nome do operador, não do cliente)
                          contactName: null,
                          groupName: isGroup ? nomeGrupo : null,
                          photoUrl: foto,
                });
                const eco = await acharEcoRecente(conv.id, c.text);
                if (eco) {
                          if (zapiMessageId && !eco.zapiMessageId) await curarZapiId(eco.id, zapiMessageId);
                          diag.status = "eco"; await registrarDiag(diag); return NextResponse.json({ ok: true });
                }
                await inserirMensagem(conv.id, {
                          direction: "OUT", body: c.text, origin: "EXTERNAL", operatorDisplayName: "Enviada fora do CRM",
                          mediaUrl: c.mediaUrl, mediaType: c.mediaType, mediaName: c.mediaName, transcript: c.transcript,
                          zapiMessageId, sendStatus: "SENT",
                });
                diag.status = "enviada";
        } else {
                // ── Ramo recebido ──
          // Aqui sim: usamos o nome do remetente para identificar/criar o contato
          const { conv } = await acharOuCriarConversa({
                    telefone, tampa, isGroup,
                    contactName: nomeRecebido,
                    groupName: isGroup ? nomeRecebido : null,
                    photoUrl: foto,
          });
                await inserirMensagem(conv.id, {
                          direction: "IN", body: c.text, senderName: isGroup ? nomeRecebido : null,
                          mediaUrl: c.mediaUrl, mediaType: c.mediaType, mediaName: c.mediaName, transcript: c.transcript,
                          zapiMessageId,
                });
                // Agenda a IA (despacho via cron) se a conversa estiver com IA ativa.
          if (conv.aiActive) {
                    await import("@/lib/db").then(({ db }) =>
                                db.whatsAppConversation.update({ where: { id: conv.id }, data: { agnesScheduledAt: new Date() } })
                                                          );
          }
                diag.status = "recebida";
        }
  } catch (e) {
        // falha REAL do banco → 500 para reenviar Z-API
      console.error("Erro [wa webhook]:", e);
        diag.status = "erro:" + String(e).slice(0, 50);
        await registrarDiag(diag);
        return NextResponse.json({ ok: false }, { status: 500 });
  }

  await registrarDiag(diag);
    return NextResponse.json({ ok: true });
}
