import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { atualizarCotacoesMercado } from "@/lib/mercado";
import { atualizarNoticias } from "@/lib/noticias";
import { atualizarCafeES, lerCafeES } from "@/lib/cafe-es";
import { tocarHeartbeat } from "@/lib/zeus/estado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Robô de mercado: bolsa + dólar, café físico do ES e notícias do setor —
// tudo gravado em Configuracao para as telas carregarem sem esperar site
// externo. Disparado pelo /api/cron/tudo a cada 30 min (o café do ES só é
// rebuscado a cada 3 h: o indicador é diário).
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const anterior = await lerCafeES();
  const precisaCafe = !anterior || Date.now() - new Date(anterior.atualizadoEm).getTime() > 3 * 3600_000;
  const [cotacoes, noticias, cafe] = await Promise.all([
    atualizarCotacoesMercado().catch((e) => ({ erro: String(e) })),
    atualizarNoticias().then((n) => ({ itens: n.itens.length })).catch((e) => ({ erro: String(e) })),
    precisaCafe ? atualizarCafeES().catch((e) => ({ ok: false, erro: String(e) })) : Promise.resolve({ ok: true, pulado: "recente" }),
  ]);
  await tocarHeartbeat("mercado");
  return NextResponse.json({ ok: true, cotacoes: "fonte" in cotacoes ? cotacoes.fonte : cotacoes, noticias, cafe });
}
