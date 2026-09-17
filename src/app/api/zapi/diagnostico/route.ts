import { NextRequest, NextResponse } from "next/server";
import { diagnosticarConexao, origemPublicaDaRequisicao } from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Diz exatamente em que elo a conexão quebrou (variáveis, servidor, chave,
// instância, webhook) em vez de devolver um "timeout" genérico.
export async function GET(req: NextRequest) {
  // O endereço que o navegador usou para chegar aqui é o endereço público
  // real do CRM — o diagnóstico testa e adota ele quando as variáveis erram.
  return NextResponse.json(await diagnosticarConexao(origemPublicaDaRequisicao(req.headers)));
}
