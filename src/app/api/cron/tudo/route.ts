import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { rodarPassada } from "@/lib/agendador";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/tudo — endpoint MESTRE de agendamento (modo 100% gratuito).
//
// O plano Hobby (grátis) da Vercel só permite 2 crons, cada um no máximo UMA
// vez por dia — com os 6 crons de minuto em minuto do vercel.json antigo, o
// deploy era simplesmente recusado. A solução: um único endpoint que decide,
// a cada chamada, quais rotinas estão na hora de rodar (pela última execução
// gravada em Configuracao) e as dispara. Quem chama este endpoint é um
// agendador externo gratuito (cron-job.org, a cada 15 min) — e, como rede de
// segurança, o único cron diário permitido pela Vercel (ver vercel.json).
//
// Por que 15 min e não 1 min: o Postgres grátis da Neon "dorme" após 5 min
// sem uso e só cobra horas de computação enquanto está acordado — um cron
// de minuto em minuto o manteria acordado 24h e estouraria a cota gratuita.
// Os caminhos em tempo real (webhook → despacho-rapido) NÃO dependem disto;
// estas rotinas são fallbacks, higiene e relatórios.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const base = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/+$/, "");
  // O cron diário da Vercel (user-agent "vercel-cron/1.0") é só rede de segurança:
  // se contasse como "o agendador chamou", esconderia o cron-job.org parado
  // durante 40 min depois de cada chamada diária.
  const daVercel = (req.headers.get("user-agent") ?? "").toLowerCase().startsWith("vercel-cron");
  return NextResponse.json(await rodarPassada({ base, segredo: process.env.CRON_SECRET, origem: daVercel ? "seguranca" : "agendador" }));
}
