import { NextResponse, type NextRequest } from "next/server";
import { carregarProposta } from "@/lib/proposta-actions";
import { gerarPdfProposta } from "@/lib/proposta-pdf";

export const dynamic = "force-dynamic";

// PDF da proposta salva (abre no navegador; ?download=1 baixa).
export async function GET(req: NextRequest, { params }: { params: { negociacaoId: string } }) {
  const carregado = await carregarProposta(params.negociacaoId);
  if (!carregado) return NextResponse.json({ erro: "Negociação não encontrada." }, { status: 404 });
  const pdf = gerarPdfProposta(carregado.dados, carregado.contexto);
  const nome = `Proposta-${(carregado.contexto.maquina ?? "maquina").replace(/[^A-Za-z0-9]+/g, "-")}-${carregado.contexto.numero}.pdf`;
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
