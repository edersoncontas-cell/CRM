import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rodarManutencao, CHAVE_MANUTENCAO } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

// POST /api/admin/manutencao
// Roda todas as rotinas de manutenção (migrações de schema + garantir* que
// antes rodavam no caminho de renderização das páginas) e marca a chave de
// guarda como concluída, para as páginas pararem de checar/disparar de novo.
// Protegida pelo middleware (exige cookie de login — não está na lista de
// rotas públicas).
// GET /api/admin/manutencao
// Só CONSULTA: a manutenção desta versão já rodou neste banco?
//
// Existe porque a pergunta "ainda falta rodar a manutenção?" não tinha
// resposta em lugar nenhum — nem na tela, nem para mim de fora. Sem isto, a
// única forma de saber era apertar o botão e ver o que acontecia.
export async function GET() {
  const cfg = await db.configuracao.findUnique({ where: { chave: CHAVE_MANUTENCAO } }).catch(() => null);
  return NextResponse.json({ emDia: cfg?.valor === "ok", chave: CHAVE_MANUTENCAO });
}

export async function POST() {
  const relatorio = await rodarManutencao();
  await db.configuracao
    .upsert({ where: { chave: CHAVE_MANUTENCAO }, update: { valor: "ok" }, create: { chave: CHAVE_MANUTENCAO, valor: "ok" } })
    .catch(() => {});
  const ok = relatorio.every((r) => r.ok);
  return NextResponse.json({ ok, relatorio });
}
