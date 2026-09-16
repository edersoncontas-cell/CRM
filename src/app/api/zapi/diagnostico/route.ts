import { NextResponse } from "next/server";
import { diagnosticarConexao } from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Diz exatamente em que elo a conexão quebrou (variáveis, servidor, chave,
// instância, webhook) em vez de devolver um "timeout" genérico.
export async function GET() {
  return NextResponse.json(await diagnosticarConexao());
}
