import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { enviarAniversariosDoDia } from "@/lib/aniversario-automatico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Parabéns automático de aniversário. Disparado pelo endpoint mestre
// (/api/cron/tudo) a partir das 8h de Brasília e, como rede de segurança,
// pelo cron diário da Vercel (vercel.json, 11:00 UTC = 8h Brasília). Manda
// uma vez por cliente por ano, então chamar duas vezes não repete.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  try {
    const r = await enviarAniversariosDoDia();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron aniversarios]", e);
    return NextResponse.json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
