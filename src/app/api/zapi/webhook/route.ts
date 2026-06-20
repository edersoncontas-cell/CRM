import { NextRequest, NextResponse } from "next/server";
import * as zapi from "@/lib/integrations/zapi";
import { isEnabled as transcricaoAtiva, transcreverBuffer } from "@/lib/integrations/transcription";
import { registrarMensagemRecebida, registrarMensagemEnviada } from "@/lib/integrations/inbox";
import { registrarDiag, type EventoDiag } from "@/lib/zapi-diag";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET de teste: abrir no navegador deve responder isto. Se der 403, o domínio
// está protegido/errado (não é o webhook que falha — é o endereço).
export async function GET() {
  return NextResponse.json({ status: "webhook active", instancia: process.env.ZAPI_INSTANCE_ID ? "configurada" : "—" });
}

// Isolamento de instância: só processa eventos da NOSSA instância Z-API.
// Conservador: sem instância esperada → permite; evento sem instanceId → permite.
function instanciaPermitida(eventoId: unknown): boolean {
  const esperado = process.env.ZAPI_INSTANCE_ID || null;
  if (!esperado) return true;
  if (!eventoId) return true;
  return String(eventoId) === esperado;
}

async function extrairTexto(
  body: any
): Promise<{ texto: string; tipo: "texto" | "audio"; transcricao?: string }> {
  if (body?.text?.message) return { texto: String(body.text.message), tipo: "texto" };
  if (typeof body?.text === "string" && body.text) return { texto: body.text, tipo: "texto" };
  if (typeof body?.message === "string" && body.message) return { texto: body.message, tipo: "texto" };

  const legenda = body?.image?.caption ?? body?.video?.caption ?? body?.document?.caption ?? body?.caption;
  if (legenda) return { texto: String(legenda), tipo: "texto" };
  if (body?.image) return { texto: "📷 Imagem", tipo: "texto" };
  if (body?.video) return { texto: "🎬 Vídeo", tipo: "texto" };
  if (body?.document) return { texto: "📄 Documento", tipo: "texto" };
  if (body?.sticker) return { texto: "Figurinha", tipo: "texto" };

  const audioUrl = body?.audio?.audioUrl ?? body?.audio?.url ?? body?.ptt?.audioUrl;
  const transcricaoZapi = body?.audio?.transcription;
  if (audioUrl) {
    if (transcricaoZapi) return { texto: String(transcricaoZapi), tipo: "audio", transcricao: String(transcricaoZapi) };
    if (!transcricaoAtiva()) return { texto: "🎵 Áudio", tipo: "audio" };
    try {
      const midia = await zapi.baixarAudio(audioUrl);
      if (!midia) return { texto: "🎵 Áudio", tipo: "audio" };
      const transcricao = await transcreverBuffer(midia.buffer, midia.mimeType);
      return { texto: transcricao || "🎵 Áudio", tipo: "audio", transcricao };
    } catch (e) {
      console.error("Erro ao transcrever áudio (Z-API):", e);
      return { texto: "🎵 Áudio", tipo: "audio" };
    }
  }
  return { texto: "", tipo: "texto" };
}

// Webhook da Z-API. Princípios da spec: grava rápido e responde 200; em falha
// REAL de banco responde 500 (para a Z-API reenviar) em vez de engolir o erro.
export async function POST(req: NextRequest) {
  let diag: Omit<EventoDiag, "em"> = { dir: "-", phone: null, nome: null, texto: "", status: "?" };
  let falhaBanco = false;
  try {
    const body = await req.json();

    if (!instanciaPermitida(body?.instanceId)) {
      await registrarDiag({ dir: "-", phone: null, nome: null, texto: "", status: "instancia-outra" });
      return NextResponse.json({ ignored: "instance-mismatch" });
    }

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
      else {
        try {
          if (body?.fromMe === true) {
            await registrarMensagemEnviada({ telefone, texto, tipo, transcricao, canal: "whatsapp", zapiId });
            diag.status = "enviada";
          } else {
            await registrarMensagemRecebida({ telefone, nomeContato: nome, texto, tipo, transcricao, canal: "whatsapp", zapiId });
            diag.status = "recebida";
          }
        } catch (e) {
          // Falha ao gravar/processar → pede reenvio (500).
          falhaBanco = true;
          diag.status = "erro:" + String(e).slice(0, 60);
        }
      }
    }
  } catch (err) {
    console.error("Erro no webhook Z-API:", err);
    diag.status = "erro:" + String(err).slice(0, 60);
  }
  await registrarDiag(diag);
  return NextResponse.json(falhaBanco ? { ok: false } : { ok: true }, { status: falhaBanco ? 500 : 200 });
}
