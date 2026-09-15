// O "robô" que faz o Orientador aprender com os casos reais do vendedor —
// duas coisas, sem exagero, sempre visível e controlável em Configurações:
//
//   1) O JEITO DE FALAR: reaproveita aprenderMeuEstilo() (lib/actions.ts) —
//      lê as últimas mensagens reais do vendedor (nunca as da IA) e grava um
//      guia de tom em EstiloDeFala. É o que faz o "usar resposta" soar como
//      o próprio vendedor, não genérico.
//   2) LIÇÕES DO HISTÓRICO: números REAIS das negociações fechadas (taxa de
//      fechamento, motivo de perda mais comum, tempo até fechar) viram um
//      resuminho de poucas linhas, injetado como CONTEXTO leve na análise do
//      Orientador — não uma regra fixa, só calibra o tom do alerta e da
//      condução para o padrão que de fato acontece com este vendedor.
//
// Roda sozinho uma vez por semana (cron) e sob demanda (botão em
// Configurações → "Atualizar aprendizado agora"). O resultado fica guardado
// em Configuracao para a tela mostrar o que foi aprendido — nada de caixa-preta.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { MOTIVOS_PERDA } from "@/lib/pipeline";

const CHAVE_APRENDIZADO = "orientador.aprendizado";
// Janela de negociações fechadas consideradas para as lições (dias).
const JANELA_DIAS = 180;
// Abaixo disso, a amostra é pequena demais para virar "lição" — só avisa.
const MINIMO_PARA_LICAO = 5;

export type NegocioFechado = { status: "ganha" | "perdida"; motivoPerda: string | null; criadoEm: Date; faturadoEm: Date | null; atualizadoEm: Date };

export type LicoesVendas = {
  totalFechadas: number;
  taxaFechamentoPct: number | null;
  diasMedioGanha: number | null;
  diasMedioPerdida: number | null;
  motivosPerda: { label: string; pct: number; qtd: number }[];
  linhas: string[]; // pronto para injetar no prompt (e mostrar na tela)
};

const diasEntre = (a: Date, b: Date): number => Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
const media = (v: number[]): number | null => (v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null);
const rotuloMotivo = (motivo: string | null): string => {
  if (!motivo) return "Não informado";
  const id = motivo.split(":")[0].trim();
  return MOTIVOS_PERDA.find((m) => m.id === id)?.label ?? "Outro";
};

// Pura e testável: só soma o que já está no banco, sem chamar IA nem rede.
export function calcularLicoesVendas(negocios: NegocioFechado[]): LicoesVendas {
  const ganhas = negocios.filter((n) => n.status === "ganha");
  const perdidas = negocios.filter((n) => n.status === "perdida");
  const total = ganhas.length + perdidas.length;

  const diasGanha = ganhas.map((n) => diasEntre(n.criadoEm, n.faturadoEm ?? n.atualizadoEm));
  const diasPerdida = perdidas.map((n) => diasEntre(n.criadoEm, n.atualizadoEm));
  const diasMedioGanha = media(diasGanha);
  const diasMedioPerdida = media(diasPerdida);

  const porMotivo = new Map<string, number>();
  for (const n of perdidas) { const r = rotuloMotivo(n.motivoPerda); porMotivo.set(r, (porMotivo.get(r) ?? 0) + 1); }
  const motivosPerda = [...porMotivo.entries()]
    .map(([label, qtd]) => ({ label, qtd, pct: Math.round((qtd / Math.max(1, perdidas.length)) * 100) }))
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 3);

  const taxaFechamentoPct = total > 0 ? Math.round((ganhas.length / total) * 100) : null;

  const linhas: string[] = [];
  if (total < MINIMO_PARA_LICAO) {
    linhas.push(`Ainda poucas negociações fechadas nos últimos ${JANELA_DIAS} dias (${total}) para tirar um padrão confiável — use com cautela.`);
  }
  if (taxaFechamentoPct != null) {
    linhas.push(`Taxa de fechamento: ${taxaFechamentoPct}% (${ganhas.length} ganha(s) de ${total} negociação(ões) fechada(s), últimos ${JANELA_DIAS} dias).`);
  }
  for (const m of motivosPerda.slice(0, 2)) {
    if (m.pct >= 15) linhas.push(`Motivo de perda mais comum: ${m.label.toLowerCase()} (${m.pct}% das perdas).`);
  }
  if (diasMedioGanha != null && diasMedioPerdida != null && perdidas.length >= 3 && ganhas.length >= 3) {
    if (diasMedioPerdida > diasMedioGanha * 1.3) {
      linhas.push(`Negociações que passam de ~${diasMedioGanha} dias sem decisão tendem a esfriar (perdidas ficaram em média ${diasMedioPerdida} dias; ganhas fecharam em ${diasMedioGanha}).`);
    } else {
      linhas.push(`Tempo médio até fechar: ${diasMedioGanha} dia(s) nas ganhas, ${diasMedioPerdida} dia(s) nas perdidas.`);
    }
  }

  return { totalFechadas: total, taxaFechamentoPct, diasMedioGanha, diasMedioPerdida, motivosPerda, linhas };
}

export type AprendizadoOrientador = { licoes: string[]; atualizadoEm: string | null; amostra: number; estiloAprendido: boolean; estiloGuia: string | null };

export async function lerAprendizadoOrientador(): Promise<AprendizadoOrientador> {
  try {
    const [raw, estilo] = await Promise.all([getConfig(CHAVE_APRENDIZADO), db.estiloDeFala.findFirst({ select: { guia: true } })]);
    const registro = raw ? (JSON.parse(raw) as { licoes: string[]; atualizadoEm: string; amostra: number }) : null;
    return { licoes: registro?.licoes ?? [], atualizadoEm: registro?.atualizadoEm ?? null, amostra: registro?.amostra ?? 0, estiloAprendido: !!estilo, estiloGuia: estilo?.guia ?? null };
  } catch {
    return { licoes: [], atualizadoEm: null, amostra: 0, estiloAprendido: false, estiloGuia: null };
  }
}

// Roda o robô: recalcula as lições do histórico E atualiza o jeito de falar
// (reaproveita a mesma rotina do botão manual / modo fim de semana). Nunca
// lança — erro num lado não impede o outro.
export async function atualizarAprendizadoOrientador(): Promise<AprendizadoOrientador> {
  const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000);
  const negocios = await db.negociacao.findMany({
    where: { status: { in: ["ganha", "perdida"] }, atualizadoEm: { gte: desde } },
    select: { status: true, motivoPerda: true, criadoEm: true, faturadoEm: true, atualizadoEm: true },
  }).catch(() => [] as NegocioFechado[]);

  const licoes = calcularLicoesVendas(negocios as NegocioFechado[]);
  await setConfig(CHAVE_APRENDIZADO, JSON.stringify({ licoes: licoes.linhas, atualizadoEm: new Date().toISOString(), amostra: licoes.totalFechadas })).catch(() => {});

  // Mesma rotina do toggle "modo fim de semana" — reaprende o tom a partir
  // das mensagens reais mais recentes. Import tardio: evita ciclo de import
  // (actions.ts também usa coisas de zeus/*).
  try {
    const { aprenderMeuEstilo } = await import("@/lib/actions");
    await aprenderMeuEstilo();
  } catch (e) {
    console.error("[orientador-aprendizado] falha ao reaprender o estilo:", e);
  }

  return lerAprendizadoOrientador();
}
