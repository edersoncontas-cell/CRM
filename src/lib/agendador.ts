// O que o endpoint mestre /api/cron/tudo faz a cada chamada: decide, pela última
// execução gravada em Configuracao, quais rotinas estão na hora e as dispara.
// Vive aqui (e não na rota) porque DOIS caminhos rodam a mesma passada:
//   · o agendador externo (cron-job.org) chamando /api/cron/tudo;
//   · o navegador aberto (/api/agendador/batida), como rede de segurança quando
//     o agendador externo para (lib/agendador-regra.ts conta a história).
// A régua de "parou?" é pura (lib/agendador-regra.ts).

import { getConfig, setConfig } from "@/lib/config";

/** Última chamada do AGENDADOR EXTERNO ao /api/cron/tudo. Só ele grava esta — a tela de Conexão compara com ela. */
export const CHAVE_PASSADA_EXTERNA = "cron.tudo.passada";
/** Última passada da REDE DE SEGURANÇA: o navegador aberto ou o cron diário da Vercel (nenhum dos dois prova que o agendador externo vive). */
export const CHAVE_PASSADA_SEGURANCA = "cron.tudo.batida";

export type Job = {
  path: string;
  // Intervalo mínimo entre execuções, em minutos.
  minutos: number;
  // Rotinas diárias/semanais: só rodam a partir desta hora (Brasília)...
  horaBrasilia?: number;
  // ...e, se definido, só neste dia da semana (0=domingo, 1=segunda...).
  diaSemana?: number;
};

export const JOBS: Job[] = [
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

export async function estaNaHora(job: Job): Promise<boolean> {
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

export type ResultadoPassada = {
  ok: true;
  rodaram: ({ path: string; status: number; corpo: unknown } | { path: string; erro: string })[];
  pulados: string[];
};

/** `origem` decide qual marca de "última passada" é gravada: a do agendador externo ou a da rede de segurança. */
export async function rodarPassada({ base, segredo, origem }: { base: string; segredo?: string; origem: "agendador" | "seguranca" }): Promise<ResultadoPassada> {
  const auth: Record<string, string> = segredo ? { Authorization: `Bearer ${segredo}` } : {};

  // A marca vai ANTES de tudo: mesmo que a passada falhe, o agendador que
  // chamou está vivo — e é isso que a tela de Conexão confere.
  await setConfig(origem === "agendador" ? CHAVE_PASSADA_EXTERNA : CHAVE_PASSADA_SEGURANCA, new Date().toISOString()).catch(() => {});

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

  return {
    ok: true,
    rodaram: resultados.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { path: paraRodar[i].path, erro: r.reason instanceof Error ? r.reason.message : String(r.reason) }
    ),
    pulados: JOBS.filter((j) => !paraRodar.includes(j)).map((j) => j.path),
  };
}

export async function lerPassadas(): Promise<{ externa: string | null; seguranca: string | null }> {
  const [externa, seguranca] = await Promise.all([
    getConfig(CHAVE_PASSADA_EXTERNA).catch(() => null),
    getConfig(CHAVE_PASSADA_SEGURANCA).catch(() => null),
  ]);
  return { externa, seguranca };
}
