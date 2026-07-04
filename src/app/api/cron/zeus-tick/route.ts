import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { executarZeusTick } from "@/lib/zeus/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// O coração do ZEUS (Fase 4): health checks, fila de trabalho, higiene de
// dados, alertas comerciais, auto-reparo e diagnóstico de erros repetidos.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const resumo = await executarZeusTick();
  return NextResponse.json(resumo);
}
