import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { temaDestaSeamana } from "@/lib/academia";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_CHAT } from "@/lib/ai/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Cron semanal: gera automaticamente uma nova estratégia de vendas baseada no tema da semana.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, erro: "sem chave" });

  const tema = temaDestaSeamana();

  const system = `Você é professor da Academia de Vendas de Máquinas Pesadas New Holland e Dynapac no sul do Espírito Santo.
Escreva uma estratégia de vendas prática, profunda e aplicável imediatamente.
Use linguagem direta, exemplos reais de máquinas pesadas (escavadeiras, compactadores, retroescavadeiras), e referências às técnicas de Psicologia, Neurociência e Negociação de Elite quando relevante.
O conteúdo deve ser de nível Mestrado/Doutorado — não básico.
Formato: título de 1 linha, seguido de conteúdo em 4-8 parágrafos ou tópicos bem desenvolvidos.
Retorne APENAS o conteúdo, sem introdução ou metadados.`;

  try {
    const msg = await anthropic().messages.create({
      model: MODEL_CHAT,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: `Gere uma estratégia completa sobre: ${tema}` }],
    });

    const bloco = msg.content[0];
    if (bloco.type !== "text") return NextResponse.json({ ok: false, erro: "sem conteúdo" });

    const linhas = bloco.text.trim().split("\n");
    const titulo = linhas[0].replace(/^#+\s*/, "").trim();
    const conteudo = linhas.slice(1).join("\n").trim();

    await db.estrategiaVenda.create({
      data: {
        titulo,
        conteudo,
        categoria: "academia-semanal",
        fonte: "ia",
        perfilAlvo: null,
      },
    });

    return NextResponse.json({ ok: true, tema, titulo });
  } catch (e) {
    console.error("[academia-atualizar] erro:", e);
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
