import { NextResponse } from "next/server";
import { obterCotacoes } from "@/lib/mercado";
import { obterNoticias } from "@/lib/noticias";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Dados do letreiro do Dashboard (cotações + notícias). O letreiro consulta
// a cada 60 s; as libs cacheiam (60 s cotações / 10 min notícias).
// Protegida pelo middleware (cookie de login).
export async function GET() {
  const [cotacoes, noticias] = await Promise.all([obterCotacoes(), obterNoticias()]);
  return NextResponse.json(
    { ok: true, cotacoes, noticias: noticias.itens, noticiasAtualizadasEm: noticias.atualizadoEm, atualizadoEm: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
