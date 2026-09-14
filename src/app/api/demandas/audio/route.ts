// Demanda por áudio: recebe a gravação do navegador (ou um texto), transcreve
// e deixa a IA montar a demanda (título, data, cliente, cidade, prioridade).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { transcreverBuffer, isEnabled as transcricaoLigada } from "@/lib/integrations/transcription";
import { criarDemandaPorTexto } from "@/lib/demandas-ia";
import { iaHabilitada } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    let texto = String(form.get("texto") ?? "").trim();
    if (audio instanceof Blob && audio.size > 0) {
      if (!transcricaoLigada()) return NextResponse.json({ ok: false, erro: "Transcrição de áudio não configurada (GROQ_API_KEY)." }, { status: 400 });
      if (audio.size > 8 * 1024 * 1024) return NextResponse.json({ ok: false, erro: "Áudio muito longo. Grave um recado mais curto." }, { status: 400 });
      texto = (await transcreverBuffer(await audio.arrayBuffer(), audio.type || "audio/webm")).trim();
    }
    if (!texto) return NextResponse.json({ ok: false, erro: "Não entendi o recado. Tente de novo falando mais perto do microfone." }, { status: 400 });
    if (!iaHabilitada()) return NextResponse.json({ ok: false, erro: "Nenhuma chave de IA configurada." }, { status: 400 });
    const demanda = await criarDemandaPorTexto(texto);
    revalidatePath("/pipeline"); revalidatePath("/alertas"); revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, transcricao: texto, demanda });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
