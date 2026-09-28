import { NextResponse } from "next/server";
import { montarPacote } from "@/lib/sem-sinal-servidor";
import { limparErro } from "@/lib/erro-legivel";

export const dynamic = "force-dynamic";

// /api/sem-sinal/pacote — o retrato que o aparelho guarda para o modo sem
// sinal (visitas, clientes, funil aberto). Só leitura. Protegido pelo
// middleware: sem login, vai para /login como qualquer outra rota.
//
// Quem chama: components/SincronizadorOffline.tsx, no máximo a cada 30 min e
// só com a tela aberta — cada chamada são seis consultas no banco.
export async function GET() {
  try {
    const pacote = await montarPacote();
    return NextResponse.json(pacote, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[sem sinal] pacote:", e);
    return NextResponse.json({ erro: limparErro(e) }, { status: 500 });
  }
}
