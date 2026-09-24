import { NextRequest, NextResponse } from "next/server";
import { obterCotacoes, atualizarCotacoesMercado, limparCacheCotacoes } from "@/lib/mercado";
import { obterNoticias, atualizarNoticias } from "@/lib/noticias";
import { atualizarCafeES, cafeESPrecisaAtualizar } from "@/lib/cafe-es";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Dados do letreiro do Dashboard (cotações + notícias). O letreiro chama
// esta rota ao abrir a tela, ao voltar o foco e a cada 15 min com a tela visível
// (INTERVALO_MERCADO, lib/intervalos-atualizacao.ts). Se alguma
// leitura estiver velha, ela é REFEITA AQUI, na hora — o preço do café, a
// bolsa e as notícias se atualizam toda vez que o CRM é aberto/atualizado,
// sem depender do cron externo. Com ?forcar=1 (botão "Atualizar"), refaz
// tudo agora. Protegida pelo middleware (cookie de login).
const VALIDADE_BOLSA_MS = 20 * 60_000;
const VALIDADE_NOTICIAS_MS = 10 * 60_000; // notícias "em tempo real": rebusca a cada 10 min
let atualizando = false;

export async function GET(req: NextRequest) {
  const forcar = req.nextUrl.searchParams.get("forcar") === "1";
  let [cotacoes, noticias] = await Promise.all([obterCotacoes(), obterNoticias()]);
  let atualizou: string[] = [];

  if (!atualizando) {
    const agora = Date.now();
    const cafeVelho = forcar || await cafeESPrecisaAtualizar().catch(() => false);
    const bolsaVelha = forcar || !cotacoes.cafeAtualizadoEm || agora - new Date(cotacoes.cafeAtualizadoEm).getTime() > VALIDADE_BOLSA_MS;
    const noticiasVelhas = forcar || !noticias.atualizadoEm || agora - new Date(noticias.atualizadoEm).getTime() > VALIDADE_NOTICIAS_MS;
    if (cafeVelho || bolsaVelha || noticiasVelhas) {
      atualizando = true;
      try {
        const r = await Promise.allSettled([
          cafeVelho ? atualizarCafeES() : Promise.resolve(null),
          bolsaVelha ? atualizarCotacoesMercado() : Promise.resolve(null),
          noticiasVelhas ? atualizarNoticias() : Promise.resolve(null),
        ]);
        const deuCerto = (i: number) => {
          const x = r[i];
          if (x.status !== "fulfilled" || x.value == null) return false;
          const v = x.value as { ok?: boolean; fonte?: string; itens?: unknown[] };
          if (i === 0) return v.ok === true;                 // café: só se leu de verdade
          if (i === 1) return v.fonte === "mercado";         // bolsa
          return Array.isArray(v.itens) && v.itens.length > 0; // notícias
        };
        atualizou = ["cafe", "bolsa", "noticias"].filter((_, i) => deuCerto(i));
        limparCacheCotacoes();
        [cotacoes, noticias] = await Promise.all([obterCotacoes(), obterNoticias()]);
      } finally {
        atualizando = false;
      }
    }
  }

  return NextResponse.json(
    { ok: true, cotacoes, noticias: noticias.itens, noticiasAtualizadasEm: noticias.atualizadoEm, atualizadoEm: new Date().toISOString(), atualizou },
    { headers: { "Cache-Control": "no-store" } }
  );
}
