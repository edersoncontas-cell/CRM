import { NextResponse } from "next/server";
import { aplicarOperacoes } from "@/lib/sem-sinal-servidor";
import { validarOperacao, type OperacaoSemSinal, type ResultadoOperacao } from "@/lib/sem-sinal-regra";
import { limparErro } from "@/lib/erro-legivel";

export const dynamic = "force-dynamic";
// Visita concluída com relato passa pela IA: uma rodada de poucas operações
// pode passar dos 10 s padrão.
export const maxDuration = 60;

// /api/sem-sinal/sincronizar — recebe o que o vendedor fez sem sinal e aplica
// em ordem. Protegido pelo middleware (exige login).
//
// POST { ops: [...] } → { agora, resultados: [{ id, ok, jaAplicada?, transitorio?, erro?, aviso? }] }
//
// Mandar a mesma operação duas vezes é seguro: ver lib/sem-sinal-servidor.ts.
const MAX_OPS = 20;

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { ops?: unknown } | null;
  const lista = Array.isArray(corpo?.ops) ? corpo.ops : null;
  if (!lista) return NextResponse.json({ erro: "Pedido sem operações." }, { status: 400 });
  if (lista.length > MAX_OPS) return NextResponse.json({ erro: `No máximo ${MAX_OPS} operações por vez.` }, { status: 400 });

  // Operação malformada é recusada com motivo e não trava as outras.
  const validas: OperacaoSemSinal[] = [];
  const recusadas: ResultadoOperacao[] = [];
  for (const x of lista) {
    const v = validarOperacao(x);
    if (v.ok) validas.push(v.op);
    else recusadas.push({ id: String((x as { id?: unknown } | null)?.id ?? ""), ok: false, erro: v.erro });
  }

  try {
    const r = await aplicarOperacoes(validas);
    return NextResponse.json({ agora: r.agora, resultados: [...recusadas, ...r.resultados] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[sem sinal] sincronizar:", e);
    return NextResponse.json({ erro: limparErro(e) }, { status: 500 });
  }
}
