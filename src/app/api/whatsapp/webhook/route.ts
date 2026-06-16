import { NextRequest, NextResponse } from "next/server";
import * as whatsapp from "@/lib/integrations/whatsapp";
import { isEnabled as transcricaoAtiva, transcreverBuffer } from "@/lib/integrations/transcription";
import { registrarMensagemRecebida } from "@/lib/integrations/inbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Verificação do webhook (Meta chama com hub.* na ativação).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const challenge = whatsapp.verificarWebhook(
    sp.get("hub.mode"),
    sp.get("hub.verify_token"),
    sp.get("hub.challenge")
  );
  if (challenge !== null) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

// Extrai o texto da mensagem conforme o tipo. Para áudio, baixa e transcreve.
async function extrairTexto(msg: any): Promise<{ texto: string; tipo: "texto" | "audio"; transcricao?: string }> {
  if (msg?.text?.body) {
    return { texto: msg.text.body, tipo: "texto" };
  }
  const legenda = msg?.image?.caption ?? msg?.video?.caption ?? msg?.document?.caption;
  if (legenda) {
    return { texto: legenda, tipo: "texto" };
  }
  const audioId = msg?.audio?.id ?? msg?.voice?.id;
  if (audioId) {
    if (!transcricaoAtiva()) {
      return { texto: "[áudio recebido — transcrição não configurada]", tipo: "audio" };
    }
    try {
      const midia = await whatsapp.baixarMidia(audioId);
      if (!midia) return { texto: "[áudio recebido — falha ao baixar]", tipo: "audio" };
      const transcricao = await transcreverBuffer(midia.buffer, midia.mimeType);
      return { texto: transcricao || "[áudio sem fala detectada]", tipo: "audio", transcricao };
    } catch (e) {
      console.error("Erro ao transcrever áudio:", e);
      return { texto: "[áudio recebido — erro na transcrição]", tipo: "audio" };
    }
  }
  return { texto: "", tipo: "texto" };
}

// Recebimento de mensagens: delega para o processador compartilhado.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const telefone = msg?.from;
    if (!msg || !telefone) return NextResponse.json({ ok: true });

    const { texto, tipo, transcricao } = await extrairTexto(msg);
    if (!texto) return NextResponse.json({ ok: true });

    const nomeContato = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name;

    await registrarMensagemRecebida({
      telefone,
      nomeContato: nomeContato ?? null,
      texto,
      tipo,
      transcricao,
      canal: "whatsapp",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro no webhook WhatsApp:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
