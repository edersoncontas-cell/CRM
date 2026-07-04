import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rodarManutencao } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

// POST /api/admin/manutencao
// Roda todas as rotinas de manutenção (migrações de schema + garantir* que
// antes rodavam no caminho de renderização das páginas) e marca a chave de
// guarda como concluída, para as páginas pararem de checar/disparar de novo.
// Protegida pelo middleware (exige cookie de login — não está na lista de
// rotas públicas).
export async function POST() {
  const relatorio = await rodarManutencao();
  await db.configuracao
    .upsert({ where: { chave: "manutencao.v1" }, update: { valor: "ok" }, create: { chave: "manutencao.v1", valor: "ok" } })
    .catch(() => {});
  const ok = relatorio.every((r) => r.ok);
  return NextResponse.json({ ok, relatorio });
}
