import { NextResponse, type NextRequest } from "next/server";
import { validarPedido, nomeDoArquivo } from "@/lib/relatorio-pedido-regra";
import { montarRelatorio } from "@/lib/relatorio-pedido";
import { gerarPdfPedido, gerarXlsxPedido } from "@/lib/relatorio-pedido-arquivo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Relatório sob demanda (PDF ou planilha). É o que o agente do Cérebro devolve
// como link: GET /api/relatorios?tipo=vendas&periodo=mes&formato=pdf
// Só leitura, protegida pelo login (middleware). Não envia nada a ninguém.

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const v = validarPedido(q);
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400 });

  try {
    const agora = new Date();
    const relatorio = await montarRelatorio(v.valor, agora);
    const nome = nomeDoArquivo(relatorio, v.valor.formato, agora);
    const corpo = v.valor.formato === "pdf" ? gerarPdfPedido(relatorio, agora) : await gerarXlsxPedido(relatorio, agora);
    return new NextResponse(new Uint8Array(corpo), {
      headers: {
        "Content-Type": v.valor.formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // PDF abre na aba (dá para ler na hora); planilha baixa.
        "Content-Disposition": `${v.valor.formato === "pdf" ? "inline" : "attachment"}; filename="${nome}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // O vendedor lê isto no navegador: diz que falhou, sem despejar detalhe interno.
    console.error("[relatorios]", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Não consegui montar o relatório agora. Tente de novo em instantes." }, { status: 500 });
  }
}
