import { NextRequest, NextResponse } from "next/server";
import { listarRelatorio, prepararResumos, gerarPdfRelatorio } from "@/lib/relatorio-conversas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Relatório de conversas do WhatsApp. Protegido pelo middleware (cookie de
// login) — não está na lista de rotas públicas.
//   GET  ?de=ISO&ate=ISO[&conversa=id][&formato=json]  -> PDF (ou JSON p/ prévia)
//   POST { de, ate, conversa? }                         -> prepara resumos IA (em lotes)

function lerFiltro(params: URLSearchParams | Record<string, unknown>) {
  const pegar = (k: string) => (params instanceof URLSearchParams ? params.get(k) : (params[k] as string | undefined)) ?? null;
  const de = new Date(pegar("de") ?? "");
  const ate = new Date(pegar("ate") ?? "");
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) return null;
  const conversaId = pegar("conversa") || pegar("conversaId") || null;
  return { de, ate, conversaId };
}

export async function GET(req: NextRequest) {
  const filtro = lerFiltro(req.nextUrl.searchParams);
  if (!filtro) return NextResponse.json({ ok: false, erro: "Período inválido (de/ate)." }, { status: 400 });

  if (req.nextUrl.searchParams.get("formato") === "json") {
    return NextResponse.json({ ok: true, linhas: await listarRelatorio(filtro) });
  }

  // Última chance de completar resumos que faltaram (orçamento curto).
  await prepararResumos(filtro, 20_000).catch(() => null);
  const linhas = await listarRelatorio(filtro);
  const pdf = gerarPdfRelatorio(linhas, filtro);
  const nome = `relatorio-whatsapp-${filtro.de.toISOString().slice(0, 10)}_${filtro.ate.toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const filtro = lerFiltro(body);
  if (!filtro) return NextResponse.json({ ok: false, erro: "Período inválido (de/ate)." }, { status: 400 });
  const r = await prepararResumos(filtro, 40_000);
  return NextResponse.json({ ok: true, ...r });
}
