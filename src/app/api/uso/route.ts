// RELATÓRIO DE USO — recebe a contagem que o navegador juntou
// (components/RegistroDeUso.tsx): uma linha por dia × hora × tela × aparelho
// × dispositivo, com o TOTAL daquela linha. O banco fica com o maior
// (GREATEST) — reenviar não conta em dobro, e o navegador pode mandar de novo
// tudo que não teve confirmação. Um envio = um comando no banco.
//
// Rota de API de propósito, não ação de tela ("use server"): ação que grava
// faz o modo sem sinal renovar as cópias das telas, e esta grava a cada
// poucos minutos — remontaria seis telas no servidor sem motivo nenhum.
//
// Atrás do login (middleware). Falhou → 503 e o navegador guarda a contagem
// para a próxima vez; nunca derruba tela nenhuma.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { limparItens, diaHoraBrasilia } from "@/lib/uso-regra";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let corpo: unknown;
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false, erro: "corpo inválido" }, { status: 400 }); }
  const itens = limparItens(corpo, diaHoraBrasilia(Date.now()).dia);
  if (!itens.length) return NextResponse.json({ ok: true, somados: 0 });

  const valores: string[] = [];
  const params: (string | number)[] = [];
  for (const i of itens) {
    const n = params.length;
    valores.push(`($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}, $${n + 7})`);
    params.push(i.dia, i.hora, i.tela, i.aparelho, i.dispositivo, i.aberturas, i.segundos);
  }
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "UsoTela" ("dia", "hora", "tela", "aparelho", "dispositivo", "aberturas", "segundos")
       VALUES ${valores.join(", ")}
       ON CONFLICT ("dia", "hora", "tela", "aparelho", "dispositivo") DO UPDATE
         SET "aberturas" = GREATEST("UsoTela"."aberturas", EXCLUDED."aberturas"),
             "segundos"  = GREATEST("UsoTela"."segundos",  EXCLUDED."segundos")`,
      ...params,
    );
    return NextResponse.json({ ok: true, somados: itens.length });
  } catch (e) {
    // Tabela ainda não criada (manutenção não rodou) ou banco fora: o
    // navegador guarda e manda de novo depois.
    console.error("[uso] não gravou:", e instanceof Error ? e.message.slice(0, 200) : e);
    return NextResponse.json({ ok: false, erro: "não gravou agora" }, { status: 503 });
  }
}
