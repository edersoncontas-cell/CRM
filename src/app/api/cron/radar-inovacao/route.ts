import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { tocarHeartbeat } from "@/lib/zeus/estado";
import { rodarRadarInovacao } from "@/lib/cerebro/radar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fim do dia: o Cérebro sai pelo mundo atrás de novidade que melhore alguma
// sessão do CRM e guarda a relação (melhoria, benefício, ganho) para o
// vendedor escolher o que aplicar.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("radar-inovacao");
  const r = await rodarRadarInovacao();
  return NextResponse.json(r);
}
