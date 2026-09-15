import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { atualizarAprendizadoOrientador } from "@/lib/zeus/orientador-aprendizado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// O robô do Orientador: recalcula as lições do histórico (taxa de
// fechamento, motivo de perda mais comum, tempo até fechar) e reaprende o
// jeito de falar do vendedor. Disparado pelo /api/cron/tudo uma vez por
// semana; também roda na hora pelo botão em Configurações.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await atualizarAprendizadoOrientador();
  return NextResponse.json({ ok: true, ...r });
}
