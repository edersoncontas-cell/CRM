import { NextRequest, NextResponse } from "next/server";
import { carregarVendasFaturadas, pontosVendas } from "@/lib/vendas-dashboard";

export const dynamic = "force-dynamic";

// Pontos do mapa de vendas do Dashboard. O mapa consulta esta rota sozinho
// (a cada 60s e ao voltar pra aba) — assim uma venda faturada ou um cadastro
// com município corrigido aparece no mapa sem recarregar a página.
// Protegida pelo middleware (cookie de login).
export async function GET(req: NextRequest) {
  const anoRaw = req.nextUrl.searchParams.get("ano");
  const ano = anoRaw && /^\d{4}$/.test(anoRaw) ? Number(anoRaw) : null;
  const vendas = await carregarVendasFaturadas();
  return NextResponse.json({ ok: true, ano, pontos: pontosVendas(vendas, ano), atualizadoEm: new Date().toISOString() });
}
