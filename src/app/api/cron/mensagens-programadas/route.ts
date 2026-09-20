import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { despacharEnviosProgramados } from "@/lib/envio-programado-despacho";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manda as mensagens em massa que estavam marcadas para sair.
//
// Roda pelo endpoint mestre /api/cron/tudo, que o agendador externo chama a
// cada 15 minutos. Por isso a mensagem sai A PARTIR do horário escolhido, na
// primeira passada — nunca antes, e não exatamente no minuto. A tela diz isso
// ao vendedor, para ele não ficar olhando o relógio às 9h em ponto.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await despacharEnviosProgramados();
  return NextResponse.json(r);
}
