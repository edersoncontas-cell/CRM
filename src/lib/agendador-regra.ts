// O AGENDADOR DO CRM — a régua, sem banco.
//
// Quem religa o WhatsApp, manda os lembretes e roda o vigia é o endpoint mestre
// /api/cron/tudo, e quem o chama é um agendador EXTERNO grátis (cron-job.org, a
// cada 15 min — a Vercel grátis só deixa um cron por dia). Se esse agendador
// para (o cron-job.org desliga sozinho um job depois de muitas falhas seguidas,
// e o CRM ficou uma semana sem banco), NADA vigia o WhatsApp: ele cai, ninguém
// religa, ninguém avisa — e a tela não dizia que o agendador tinha parado.
//
// Aqui mora a decisão de "parou?" (para a tela avisar) e de "vale rodar a
// passada agora, a partir do navegador aberto?" (rede de segurança: o CRM
// aberto no celular dele cobre o agendador morto). Puro: o cliente importa.

/** O agendador externo chama a cada 15 min; 40 min sem chamada é parado (duas falhas seguidas + folga). */
export const TOLERANCIA_PARADO_MIN = 40;

/** A rede de segurança do navegador só age quando nada rodou há mais que isto. */
export const BATIDA_SE_ATRASADO_MIN = 20;

function minutosDesde(iso: string | null | undefined, agora: Date): number | null {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  return Math.floor((agora.getTime() - t) / 60_000);
}

export type SaudeAgendador =
  | { tipo: "ok"; ultima: string; minutos: number }
  /** `ultima` null = nunca chamou (ou o registro é ilegível — nunca esconde o problema). */
  | { tipo: "parado"; ultima: string | null; minutos: number | null };

/** O AGENDADOR EXTERNO (cron-job.org) está chamando? Só a chamada dele conta — a batida do navegador não. */
export function saudeAgendador(ultimaChamadaExterna: string | null | undefined, agora: Date, toleranciaMin = TOLERANCIA_PARADO_MIN): SaudeAgendador {
  const min = minutosDesde(ultimaChamadaExterna, agora);
  if (min == null) return { tipo: "parado", ultima: null, minutos: null };
  // Relógio do servidor adiantado em relação ao registro: não é queda.
  if (min <= toleranciaMin) return { tipo: "ok", ultima: ultimaChamadaExterna as string, minutos: Math.max(0, min) };
  return { tipo: "parado", ultima: ultimaChamadaExterna as string, minutos: min };
}

/**
 * O navegador aberto deve disparar a passada? Sim quando NADA (nem o agendador
 * nem uma batida anterior) rodou há mais que o limite — ou quando não se sabe.
 * Padrão seguro para o vigia: na dúvida, roda (a passada é idempotente: cada
 * rotina respeita o próprio intervalo mínimo).
 */
export function precisaBater(ultimaExterna: string | null | undefined, ultimaBatida: string | null | undefined, agora: Date, atrasoMin = BATIDA_SE_ATRASADO_MIN): boolean {
  const a = minutosDesde(ultimaExterna, agora);
  const b = minutosDesde(ultimaBatida, agora);
  const maisRecente = [a, b].filter((m): m is number => m != null).sort((x, y) => x - y)[0];
  if (maisRecente == null) return true;
  return maisRecente > atrasoMin;
}

/** "há 25 min", "há 3 h", "há 2 dias". */
export function haQuanto(minutos: number | null): string {
  if (minutos == null) return "nunca chamou";
  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  const h = Math.floor(minutos / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}
