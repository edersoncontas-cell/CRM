import { NextRequest, NextResponse } from "next/server";
import { registrarZeusEvent } from "@/lib/zeus/eventos";

export const dynamic = "force-dynamic";

// Recebe erros de renderização capturados pelo global-error.tsx (client
// component — não pode chamar o Prisma diretamente) e grava um ZeusEvent.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mensagem = typeof body.mensagem === "string" ? body.mensagem.slice(0, 300) : "erro desconhecido";
  const digest = typeof body.digest === "string" ? body.digest : undefined;
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 2000) : undefined;

  await registrarZeusEvent({
    tipo: "erro",
    severidade: "alta",
    titulo: `Erro de renderização (global-error): ${mensagem}`,
    detalhe: { mensagem, digest, stack },
  });

  return NextResponse.json({ ok: true });
}
