import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { processarPendentes } from "@/lib/zeus/pipeline";
import { tocarHeartbeat } from "@/lib/zeus/estado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fallback do pipeline de inteligência automática (Fase 2): processa
// mensagens de WhatsApp que ficaram sem `processedAt` porque o webhook não
// conseguiu concluir o pipeline em tempo real (erro transitório, timeout).
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("zeus-pipeline");
  const resultado = await processarPendentes(25);
  return NextResponse.json({ ok: true, ...resultado });
}
