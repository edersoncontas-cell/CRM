import { NextRequest, NextResponse } from "next/server";
import * as zapi from "@/lib/integrations/zapi";
import { isEnabled as transcricaoAtiva, transcreverBuffer } from "@/lib/integrations/transcription";
import { registrarMensagemRecebida, registrarMensagemEnviada } from "@/lib/integrations/inbox";
import { registrarDiag, type EventoDiag } from "@/lib/zapi-diag";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Extrai o texto da mensagem da Z-API. Para áudio, baixa e transcreve.
async function extrairTexto(
  body: any
): Promise<{ texto: string; tipo: "texto" | "audio"; transcricao?: string }> {
  if (body?.text?.message) return { texto: String(body.text.message), tipo: "texto" };
  if (typeof body?.text === "string" && body.text) return { texto: body.text, tipo: "texto" };

  const legenda = body?.image?.caption ?? body?.video?.caption ?? body?.document?.caption;
  if (legenda) return { texto: String(legenda), tipo: "texto" };
  if (body?.image) return { texto: "[imagem]", tipo: "texto" };

  const audioUrl = body?.audio?.audioUrl ?? body?.ptt?.audioUrl;
  if (audioUrl) {
    if (!transcricaoAtiva()) return { texto: "[áudio recebido — transcrição não configurada]", tipo: "audio" };
    try {
      const midia = await zapi.baixarAudio(audioUrl);
      if (!midia) return { texto: "[áudio recebido — falha ao baixar]", tipo: "audio" };
      const transcricao = await transcreverBuffer(midia.buffer, midia.mimeType);
      return { texto: transcricao || "[áudio sem fala detectada]", tipo: "audio", transcricao };
    } catch (e) {
      console.error("Erro ao transcrever áudio (Z-API):", e);
      return { texto: "[áudio recebido — erro na transcrição]", tipo: "audio" };
    }
  }
  return { texto: "", tipo: "texto" };
}

// Recebe os callbacks de mensagem da Z-API (configurar "Ao receber" no painel).
export async function POST(req: NextRequest) {
  let diag: Omit<EventoDiag, "em"> = { dir: "-", phone: null, nome: null, texto: "", status: "?" };
  try {
    const body = await req.json();
    const telefone: string | null = body?.phone ? String(body.phone) : null;
    const nome: string | null = body?.senderName ?? body?.chatName ?? null;
    diag = { dir: body?.fromMe ? "out" : "in", phone: telefone, nome, texto: "", status: "?" };

    console.log("[zapi webhook]", JSON.stringify({
      type: body?.type, fromMe: body?.fromMe, phone: telefone,
      isGroup: body?.isGroup, isStatusReply: body?.isStatusReply, temTexto: !!(body?.text?.message),
    }));

    if (body?.isStatusReply === true) { diag.status = "status"; }
    else if (body?.isGroup === true) { diag.status = "grupo"; }
    else if (!telefone) { diag.status = "sem-telefone"; }
    else {
      const { texto, tipo, transcricao } = await extrairTexto(body);
      diag.texto = texto;
      const zapiId = body?.messageId ? String(body.messageId) : null;
      if (!texto) { diag.status = "sem-texto"; }
      else if (body?.fromMe === true) {
        await registrarMensagemEnviada({ telefone, texto, tipo, transcricao, canal: "whatsapp", zapiId });
        diag.status = "enviada";
      } else {
        await registrarMensagemRecebida({ telefone, nomeContato: nome, texto, tipo, transcricao, canal: "whatsapp", zapiId });
        diag.status = "recebida";
      }
    }
  } catch (err) {
    console.error("Erro no webhook Z-API:", err);
    diag.status = "erro:" + String(err).slice(0, 60);
  }
  await registrarDiag(diag);
  return NextResponse.json({ ok: true });
}
