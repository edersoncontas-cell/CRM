import { NextRequest, NextResponse } from "next/server";
import { lerPassadas, rodarPassada } from "@/lib/agendador";
import { precisaBater } from "@/lib/agendador-regra";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/agendador/batida — a REDE DE SEGURANÇA do agendador externo.
//
// O CRM aberto (celular ou computador) bate aqui de tempos em tempos. Se nada
// rodou há mais de BATIDA_SE_ATRASADO_MIN (o cron-job.org parou, a rota mestre
// falhou), roda a MESMA passada do /api/cron/tudo — o vigia religa o WhatsApp,
// os lembretes saem, o Google sincroniza. Se está tudo em dia, só lê duas
// linhas e responde. Fica atrás do login (middleware): quem bate é ele, aberto.
export async function POST(req: NextRequest) {
  const { externa, seguranca } = await lerPassadas();
  if (!precisaBater(externa, seguranca, new Date())) return NextResponse.json({ ok: true, rodou: false });

  const base = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/+$/, "");
  const r = await rodarPassada({ base, segredo: process.env.CRON_SECRET, origem: "seguranca" });
  return NextResponse.json({
    ok: true,
    rodou: true,
    rodaram: r.rodaram.map((x) => ("erro" in x ? { path: x.path, erro: x.erro } : { path: x.path, status: x.status })),
  });
}
