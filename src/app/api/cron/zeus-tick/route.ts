import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { executarZeusTick } from "@/lib/zeus/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// O coração do ZEUS (Fase 4): health checks, fila de trabalho, higiene de
// dados, alertas comerciais, auto-reparo e diagnóstico de erros repetidos.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // viaCronAutomatico: pula a fila de pendentes aqui — o cron `zeus-pipeline`
  // já roda a mesma fila nesta mesma passada de 15 min (ver lib/zeus/tick.ts).
  const resumo = await executarZeusTick({ viaCronAutomatico: true });
  return NextResponse.json(resumo);
}
