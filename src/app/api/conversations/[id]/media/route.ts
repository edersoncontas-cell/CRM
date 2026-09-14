import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendImageBase64, sendAudioBase64, sendDocumentBase64 } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";
import { marcarRespondidoAction } from "@/lib/atendimento-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMITE_BYTES = 3 * 1024 * 1024; // corpo da função na Vercel: 4,5 MB

// Envia foto, áudio gravado ou documento pelo WhatsApp a partir do CRM.
// body: { kind: "image"|"audio"|"document", base64, mimeType, fileName?, caption?, thumb? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  const base64 = String(body.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
  const mimeType = String(body.mimeType ?? "application/octet-stream");
  const fileName = String(body.fileName ?? "").trim() || null;
  const caption = String(body.caption ?? "").trim();
  const thumb = typeof body.thumb === "string" && body.thumb.startsWith("data:image/") && body.thumb.length < 120_000 ? body.thumb : null;
  if (!["image", "audio", "document"].includes(kind) || !base64) return NextResponse.json({ ok: false, erro: "Arquivo inválido." }, { status: 400 });
  if (base64.length * 0.75 > LIMITE_BYTES) return NextResponse.json({ ok: false, erro: "Arquivo acima de 3 MB. Reduza o tamanho." }, { status: 413 });

  const conv = await db.whatsAppConversation.findUnique({ where: { id: params.id } });
  if (!conv) return NextResponse.json({ ok: false, erro: "Conversa não encontrada." }, { status: 404 });

  const corpo = kind === "image" ? (caption || "📷 Foto") : kind === "audio" ? "🎤 Áudio enviado" : (caption ? `${fileName ?? "📄 Documento"} — ${caption}` : fileName ?? "📄 Documento");
  try {
    const id = kind === "image"
      ? await sendImageBase64(conv.externalPhone, base64, mimeType, caption || undefined)
      : kind === "audio"
      ? await sendAudioBase64(conv.externalPhone, base64, mimeType)
      : await sendDocumentBase64(conv.externalPhone, base64, fileName ?? "documento.pdf", mimeType, caption || undefined);
    const msg = await inserirMensagem(conv.id, {
      direction: "OUT", body: corpo, origin: "CRM", operatorDisplayName: "Você",
      mediaType: kind, mediaName: fileName, mediaUrl: kind === "image" ? thumb : null,
      zapiMessageId: id || null, sendStatus: id ? "SENT" : "UNCONFIRMED",
    });
    await marcarRespondidoAction(conv.id).catch(() => {});
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
