import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { getConfig, setConfig } from "@/lib/config";

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

type Job = {
  path: string;
  // Intervalo mínimo entre execuções, em minutos.
  minutos: number;
  // Rotinas diárias/semanais: só rodam a partir desta hora (Brasília)...
  horaBrasilia?: number;
  // ...e, se definido, só neste dia da semana (0=domingo, 1=segunda...).
  diaSemana?: number;
};

const JOBS: Job[] = [
  { path: "/api/cron/agnes-dispatch", minutos: 1 },
  { path: "/api/cron/zeus-pipeline", minutos: 1 },
  { path: "/api/cron/whatsapp-retry", minutos: 5 },
  // Mensagens em massa marcadas para sair mais tarde. Roda a cada passada:
  // é o que faz a mensagem sair logo depois do horário escolhido.
  { path: "/api/cron/mensagens-programadas", minutos: 1 },
  // Vigia da conexão: religa o WhatsApp sozinho antes de incomodar com o QR.
  { path: "/api/cron/whatsapp-vigia", minutos: 5 },
  { path: "/api/cron/zeus-tick", minutos: 5 },
  { path: "/api/cron/mercado", minutos: 30 },
  { path: "/api/cron/google-contatos", minutos: 60 },
  { path: "/api/cron/zeus-diario", minutos: 20 * 60, horaBrasilia: 9 },
  // Parabéns de aniversário: a partir das 8h, uma vez por dia.
  { path: "/api/cron/aniversarios", minutos: 20 * 60, horaBrasilia: 8 },
  { path: "/api/cron/academia-atualizar", minutos: 6 * 24 * 60, horaBrasilia: 8, diaSemana: 1 },
  // Fim do dia: relatório do que aconteceu (só conversas de negociação) e a
  // varredura mundial do radar de inovação. 19h e 20h de Brasília.
  { path: "/api/cron/relatorio-diario", minutos: 20 * 60, horaBrasilia: 19 },
  { path: "/api/cron/radar-inovacao", minutos: 20 * 60, horaBrasilia: 20 },
  // Robô do Orientador: lições do histórico (taxa de fechamento, motivo de
  // perda, tempo até fechar) + reaprende o jeito de falar do vendedor.
  { path: "/api/cron/orientador-aprender", minutos: 7 * 24 * 60, horaBrasilia: 5, diaSemana: 1 },
];

function agoraBrasilia(): { hora: number; diaSemana: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false, weekday: "short",
  }).formatToParts(new Date());
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const diaSemana = dias.indexOf(partes.find((p) => p.type === "weekday")?.value ?? "Sun");
  return { hora, diaSemana: diaSemana < 0 ? 0 : diaSemana };
}

function chaveUltimaExecucao(job: Job): string {
  return `cron.tudo.ultima.${job.path.replace(/^\/api\/cron\//, "")}`;
}

async function estaNaHora(job: Job): Promise<boolean> {
  const ultimaRaw = await getConfig(chaveUltimaExecucao(job)).catch(() => null);
  const ultima = ultimaRaw ? new Date(ultimaRaw).getTime() : 0;
  if (Date.now() - ultima < job.minutos * 60_000) return false;

  if (job.horaBrasilia != null || job.diaSemana != null) {
    const { hora, diaSemana } = agoraBrasilia();
    if (job.horaBrasilia != null && hora < job.horaBrasilia) return false;
    if (job.diaSemana != null && diaSemana !== job.diaSemana) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const base = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/+$/, "");
  const auth: Record<string, string> = process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {};

  const paraRodar: Job[] = [];
  for (const job of JOBS) {
    if (await estaNaHora(job)) paraRodar.push(job);
  }

  // Marca como executada ANTES de disparar: se uma rotina demorar, a próxima
  // chamada do agendador não a dispara em cima da anterior ainda rodando.
  await Promise.all(paraRodar.map((job) => setConfig(chaveUltimaExecucao(job), new Date().toISOString()).catch(() => {})));

  const resultados = await Promise.allSettled(
    paraRodar.map(async (job) => {
      const res = await fetch(`${base}${job.path}`, {
        headers: auth,
        cache: "no-store",
        signal: AbortSignal.timeout(50_000),
      });
      const corpo = await res.json().catch(() => null);
      return { path: job.path, status: res.status, corpo };
    })
  );

  return NextResponse.json({
    ok: true,
    rodaram: resultados.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { path: paraRodar[i].path, erro: r.reason instanceof Error ? r.reason.message : String(r.reason) }
    ),
    pulados: JOBS.filter((j) => !paraRodar.includes(j)).map((j) => j.path),
  });
}
