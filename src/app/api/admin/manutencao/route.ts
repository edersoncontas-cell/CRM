import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rodarManutencao, CHAVE_MANUTENCAO, situacaoDaManutencao } from "@/lib/manutencao";
import { marcaDeFalha } from "@/lib/manutencao-retentativa";

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
  const marca = await situacaoDaManutencao();
  return NextResponse.json({ emDia: marca.estado === "ok", chave: CHAVE_MANUTENCAO, marca });
}

export async function POST() {
  const relatorio = await rodarManutencao();
  const ok = relatorio.every((r) => r.ok);
  // Só grava "ok" se foi ok. Falhou, a marca diz que falhou — assim a tela
  // não fica dizendo "em dia" para uma migração que não passou.
  const falhas = relatorio.filter((r) => !r.ok).map((r) => `${r.etapa}: ${r.erro}`).join(" | ");
  const valor = ok ? "ok" : marcaDeFalha(0, Date.now(), falhas);
  await db.configuracao
    .upsert({ where: { chave: CHAVE_MANUTENCAO }, update: { valor }, create: { chave: CHAVE_MANUTENCAO, valor } })
    .catch(() => {});
  return NextResponse.json({ ok, relatorio });
}
