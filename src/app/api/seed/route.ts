import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { semear } from "@/lib/seed-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Rota de povoamento inicial do banco em produção.
// Protegida pelo middleware (exige login) + confirmação por senha na query.
// É idempotente: usa upsert e checagens de count, então pode rodar mais de uma vez.
export async function GET(req: NextRequest) {
  const senha = req.nextUrl.searchParams.get("senha");
  if (process.env.APP_PASSWORD && senha !== process.env.APP_PASSWORD) {
    return NextResponse.json(
      { ok: false, erro: "Senha inválida. Use ?senha=SUA_SENHA_DO_CRM" },
      { status: 401 },
    );
  }

  try {
    const resultado = await semear(db);
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    console.error("Erro no seed:", e);
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
