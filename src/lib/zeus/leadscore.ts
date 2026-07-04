// Lead scoring (FASE 5 do Projeto Zeus, item 1): score 0-100 por cliente,
// recalculado pelo ZEUS a cada tick — substitui o termômetro fixo (que só
// existe por negociação e só se move por ajuste incremental de sentimento)
// por uma regra que combina recência, valor, estágio do funil, sinais de
// compra (visita agendada, concorrente citado) e o próprio termômetro como
// proxy de sentimento acumulado. Alimenta o widget "Top 5 para atacar hoje"
// do dashboard, o Radar de Silêncio e o briefing diário do ZEUS.

import { db } from "@/lib/db";
import { PROB_ESTAGIO } from "@/lib/insights";

export type FatoresLeadScore = {
  termometro: number | null;
  valor: number | null;
  estagio: string | null;
  diasSemContato: number | null;
  temVisitaAgendada: boolean;
  concorrenteMencionado: boolean;
  aguardandoResposta: boolean;
  temNegociacaoAberta: boolean;
  interesseFuturo: boolean;
};

// Cliente sem sinal comercial ativo (sem negociação aberta, sem aguardar
// resposta, sem interesse futuro registrado) — score só reflete o quão frio
// ficou desde o último contato. É esse ramo que alimenta o Radar de Silêncio.
function scoreFrio(diasSemContato: number | null): number {
  let score = 30;
  if (diasSemContato != null) score -= Math.min(30, Math.floor(diasSemContato / 10) * 5);
  return Math.max(0, Math.min(100, score));
}

export function calcularLeadScore(f: FatoresLeadScore): number {
  if (!f.temNegociacaoAberta && !f.aguardandoResposta && !f.interesseFuturo) {
    return scoreFrio(f.diasSemContato);
  }

  let score = (f.termometro ?? 50) * 0.35;

  if ((f.valor ?? 0) >= 1_000_000) score += 25;
  else if ((f.valor ?? 0) >= 400_000) score += 15;
  else if ((f.valor ?? 0) >= 150_000) score += 8;

  score += (PROB_ESTAGIO[f.estagio ?? ""] ?? 0) * 20;

  const dias = f.diasSemContato ?? 999;
  if (dias <= 2) score += 15;
  else if (dias <= 5) score += 10;
  else if (dias <= 10) score += 4;
  else if (dias >= 20) score -= 15;

  if (f.temVisitaAgendada) score += 10;
  if (f.concorrenteMencionado) score += 4;
  if (f.aguardandoResposta) score += 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function diasEntre(a: Date | null, b = new Date()): number | null {
  if (!a) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

// Recalcula o leadScore de clientes com sinal comercial ativo (sempre) e de
// uma leva limitada de clientes "frios" com score desatualizado há 1+ dia
// (para o score decair com o tempo sem precisar varrer a base inteira a
// cada 5 minutos). Só grava no banco quando o valor muda de fato.
export async function recalcularLeadScores(): Promise<{ atualizados: number }> {
  let atualizados = 0;
  const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const ativos = await db.cliente.findMany({
    where: {
      OR: [
        { negociacoes: { some: { status: "aberta" } } },
        { aguardandoResposta: true },
        { interesseFuturo: true },
      ],
    },
    select: {
      id: true, leadScore: true, ultimoContato: true, aguardandoResposta: true,
      interesseFuturo: true, proximaVisita: true,
      negociacoes: {
        where: { status: "aberta" },
        select: { termometro: true, valor: true, estagio: true, dataVisita: true, concorrenteMencionado: true },
        orderBy: { termometro: "desc" },
        take: 1,
      },
    },
    take: 500,
  });

  const frios = await db.cliente.findMany({
    where: {
      aguardandoResposta: false,
      interesseFuturo: false,
      negociacoes: { none: { status: "aberta" } },
      OR: [{ leadScoreAtualizadoEm: null }, { leadScoreAtualizadoEm: { lt: umDiaAtras } }],
    },
    select: { id: true, leadScore: true, ultimoContato: true },
    orderBy: { leadScoreAtualizadoEm: "asc" },
    take: 200,
  });

  for (const c of ativos) {
    const melhorNeg = c.negociacoes[0] ?? null;
    const score = calcularLeadScore({
      termometro: melhorNeg?.termometro ?? null,
      valor: melhorNeg?.valor ?? null,
      estagio: melhorNeg?.estagio ?? null,
      diasSemContato: diasEntre(c.ultimoContato),
      temVisitaAgendada: !!(melhorNeg?.dataVisita || c.proximaVisita),
      concorrenteMencionado: !!melhorNeg?.concorrenteMencionado,
      aguardandoResposta: c.aguardandoResposta,
      temNegociacaoAberta: c.negociacoes.length > 0,
      interesseFuturo: c.interesseFuturo,
    });
    if (score !== c.leadScore) {
      await db.cliente.update({ where: { id: c.id }, data: { leadScore: score, leadScoreAtualizadoEm: new Date() } });
      atualizados++;
    }
  }

  for (const c of frios) {
    const score = scoreFrio(diasEntre(c.ultimoContato));
    await db.cliente.update({ where: { id: c.id }, data: { leadScore: score, leadScoreAtualizadoEm: new Date() } });
    if (score !== c.leadScore) atualizados++;
  }

  return { atualizados };
}
