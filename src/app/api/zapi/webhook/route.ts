import { NextRequest, NextResponse } from "next/server";
import * as zapi from "@/lib/integrations/zapi";
import { isEnabled as transcricaoAtiva, transcreverBuffer } from "@/lib/integrations/transcription";
import { registrarMensagemRecebida, registrarMensagemEnviada } from "@/lib/integrations/inbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Extrai o texto da mensagem da Z-API. Para áudio, baixa e transcreve.
async function extrairTexto(
  body: any
): Promise<{ texto: string; tipo: "texto" | "audio"; transcricao?: string }> {
  // Texto simples
  if (body?.text?.message) return { texto: String(body.text.message), tipo: "texto" };

  // Imagem/vídeo/documento com legenda
  const legenda = body?.image?.caption ?? body?.video?.caption ?? body?.document?.caption;
  if (legenda) return { texto: String(legenda), tipo: "texto" };

  // Áudio / mensagem de voz (a Z-API entrega uma URL direta).
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
  try {
    const body = await req.json();

    // Ignora atualizações de status e grupos.
    if (body?.isStatusReply === true) return NextResponse.json({ ok: true });
    if (body?.isGroup === true) return NextResponse.json({ ok: true });

    const telefone = body?.phone;
    if (!telefone) return NextResponse.json({ ok: true });

    const { texto, tipo, transcricao } = await extrairTexto(body);
    if (!texto) return NextResponse.json({ ok: true });

    // Mensagem enviada por mim (pelo celular): sincroniza o histórico e, se for
    // áudio agendando visita, a IA joga na agenda.
    if (body?.fromMe === true) {
      await registrarMensagemEnviada({ telefone, texto, tipo, transcricao, canal: "whatsapp" });
      return NextResponse.json({ ok: true });
    }

    await registrarMensagemRecebida({
      telefone,
      nomeContato: body?.senderName ?? body?.chatName ?? null,
      texto,
      tipo,
      transcricao,
      canal: "whatsapp",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro no webhook Z-API:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
