import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { temaDestaSeamana } from "@/lib/academia";
import { llmTexto, iaHabilitada } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron semanal: gera automaticamente uma nova estratégia de vendas baseada no
// tema da semana. Roteado por llmTexto (Gemini/Groq grátis, com fallback).
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!iaHabilitada()) return NextResponse.json({ ok: false, erro: "sem chave de IA" });

  const tema = temaDestaSeamana();

  const system = `Você é professor da Academia de Vendas de Máquinas Pesadas New Holland e Dynapac no sul do Espírito Santo.
Escreva uma estratégia de vendas prática, profunda e aplicável imediatamente.
Use linguagem direta, exemplos reais de máquinas pesadas (escavadeiras, compactadores, retroescavadeiras), e referências às técnicas de Psicologia, Neurociência e Negociação de Elite quando relevante.
O conteúdo deve ser de nível Mestrado/Doutorado — não básico.
Formato: título de 1 linha, seguido de conteúdo em 4-8 parágrafos ou tópicos bem desenvolvidos.
Retorne APENAS o conteúdo, sem introdução ou metadados.`;

  try {
    const texto = (await llmTexto(system, `Gere uma estratégia completa sobre: ${tema}`, { maxTokens: 1200 })).trim();
    if (!texto) return NextResponse.json({ ok: false, erro: "sem conteúdo" });

    const linhas = texto.split("\n");
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
