import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { tocarHeartbeat } from "@/lib/zeus/estado";
import { gerarRelatorioDiario, enviarRelatorioDiario } from "@/lib/cerebro/relatorio-diario";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fim do dia: monta o relatório do que aconteceu (só conversas em que houve
// negociação de verdade) e manda no WhatsApp do vendedor.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("relatorio-diario");

  try {
    const relatorio = await gerarRelatorioDiario();
    const envio = await enviarRelatorioDiario(relatorio);
    return NextResponse.json({
      ok: true,
      negociacoes: relatorio.negociacoes,
      novos: relatorio.novos,
      carteira: relatorio.carteira,
      enviado: envio.enviado,
      motivo: envio.motivo,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
