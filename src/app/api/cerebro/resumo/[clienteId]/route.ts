import { NextRequest, NextResponse } from "next/server";
import { gerarResumoClienteIA } from "@/lib/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cerebro/resumo/[clienteId]
// Gera o resumo do cliente pelo Cérebro e salva no cadastro.
export async function POST(_req: NextRequest, { params }: { params: { clienteId: string } }) {
  const { clienteId } = params;
  if (!clienteId) return NextResponse.json({ ok: false, erro: "clienteId obrigatório" }, { status: 400 });

  const resultado = await gerarResumoClienteIA(clienteId);
  if (!resultado.ok) {
    return NextResponse.json({ ok: false, erro: resultado.erro ?? "Erro ao gerar resumo" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, resumo: resultado.resumo });
}
