import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";
import { rodarVolta, clienteDoProvisorio, conferirConexoes, TOTAL_ETAPAS, type ResultadoVolta } from "@/lib/trazer-provisorio";
import { lerEstadoProvisorio, limparErro, MARCA_VOLTA } from "@/lib/trazer-provisorio-estado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// /api/admin/trazer-provisorio — a volta do banco provisório para o principal.
// Protegida pelo middleware (exige login; não está na lista de rotas públicas).
//
// GET              → estado: tem provisório configurado? é o mesmo banco do
//                    principal? (só o provedor; o endereço tem senha e NUNCA sai)
// GET ?previa=1    → compara os dois bancos e diz, tabela por tabela, o que
//                    entra e o que já existe. Não grava nada.
// POST {inicio}    → traz, a partir da etapa `inicio`, até o tempo acabar.
//                    A tela repete com `proxima` até `concluido`.

export async function GET(req: Request) {
  const estado = await lerEstadoProvisorio();
  const querPrevia = new URL(req.url).searchParams.get("previa") === "1";
  if (!querPrevia) return NextResponse.json({ estado });
  const origem = clienteDoProvisorio();
  if (!origem || estado.mesmoBanco) return NextResponse.json({ estado, erro: estado.mesmoBanco ? "mesmo-banco" : "sem-provisorio" });
  try {
    await conferirConexoes(origem, db);
    const previa = await rodarVolta({ origem, destino: db, aplicar: false });
    return NextResponse.json({ estado, previa });
  } catch (e) {
    return NextResponse.json({ estado, erro: limparErro(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const estado = await lerEstadoProvisorio();
  const origem = clienteDoProvisorio();
  if (!origem) return NextResponse.json({ erro: "Não há banco provisório configurado (DATABASE_URL_PROVISORIO)." }, { status: 400 });
  if (estado.mesmoBanco) {
    return NextResponse.json({ erro: "O banco em uso ainda é o provisório. Troque o DATABASE_URL para o principal antes de trazer." }, { status: 400 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { inicio?: number };
  const inicio = Math.max(0, Math.min(TOTAL_ETAPAS, Number(corpo.inicio) || 0));
  let r: ResultadoVolta;
  try {
    await conferirConexoes(origem, db);
    r = await rodarVolta({ origem, destino: db, aplicar: true, inicio, prazoMs: 40_000 });
  } catch (e) {
    return NextResponse.json({ erro: limparErro(e) }, { status: 502 });
  }
  const gravadas = r.etapas.reduce((s, e) => s + e.gravadas + e.atualizadas, 0);
  const anterior = inicio > 0 ? estado.ultima?.gravadas ?? 0 : 0;
  const marca = { quando: new Date().toISOString(), concluido: r.concluido, gravadas: anterior + gravadas };
  await db.configuracao
    .upsert({ where: { chave: MARCA_VOLTA }, update: { valor: JSON.stringify(marca) }, create: { chave: MARCA_VOLTA, valor: JSON.stringify(marca) } })
    .catch(() => {});
  if (r.concluido) {
    await registrarAudit({
      acao: "dados_provisorio_trazidos", origem: "usuario",
      descricao: `Dados do banco provisório trazidos para o principal: ${marca.gravadas} registro(s) gravado(s) ou completado(s).`,
    }).catch(() => {});
  }
  return NextResponse.json({ ...r, erros: r.etapas.filter((e) => e.erro).map((e) => ({ ...e, erro: e.erro ? limparErro(e.erro) : e.erro })) });
}
