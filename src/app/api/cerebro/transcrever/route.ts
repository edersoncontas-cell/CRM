import { NextResponse } from "next/server";
import { transcreverBuffer, isEnabled as transcricaoLigada } from "@/lib/integrations/transcription";
import { validarAudio, limparTranscricao } from "@/lib/voz-regra";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Voz no Cérebro: recebe a gravação do navegador e devolve SÓ o texto. Não
// executa nada — o texto vai para a caixa de mensagem (ou, se ele ligou o envio
// automático, para o mesmo caminho de uma mensagem digitada). Protegida pelo
// login (middleware). Transcrição: Groq (grátis); OpenAI só com a trava de
// gasto liberada (lib/integrations/transcription.ts).

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) return NextResponse.json({ ok: false, erro: "Nenhum áudio recebido." }, { status: 400 });
    const v = validarAudio(audio.size);
    if (!v.ok) return NextResponse.json({ ok: false, erro: v.erro }, { status: 400 });
    if (!transcricaoLigada()) {
      return NextResponse.json({ ok: false, erro: "Transcrição de áudio não está configurada neste CRM (falta a chave do Groq)." }, { status: 503 });
    }
    const texto = limparTranscricao(await transcreverBuffer(await audio.arrayBuffer(), audio.type || "audio/webm"));
    if (!texto) return NextResponse.json({ ok: false, erro: "Não entendi o comando. Tente de novo falando mais perto do microfone." }, { status: 422 });
    return NextResponse.json({ ok: true, texto });
  } catch (e) {
    // Detalhe do provedor vai para o log do servidor, não para a tela.
    console.error("[cerebro/transcrever]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, erro: "Não consegui transcrever agora. Tente de novo ou digite o comando." }, { status: 502 });
  }
}
