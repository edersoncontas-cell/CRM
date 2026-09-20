// O HISTÓRICO DE VISITAS DE UM CLIENTE, COMO O VENDEDOR PERGUNTA.
//
//   "quero que no cadastro do cliente tenha o registro de quantas visitas ele
//    teve, em que dia, mês e ano, e a quantidade de dias desde a última visita."
//
// Duas contas que parecem uma só e não são:
//
//   quantas visitas ele TEVE   → as que aconteceram (status "realizada").
//                                Visita agendada para a semana que vem não é
//                                visita que ele teve.
//   dias desde a última        → também conta da última REALIZADA. Contar de
//                                uma visita agendada daria "faz -3 dias", e
//                                contar de uma que não aconteceu mentiria
//                                dizendo que o cliente foi atendido.
//
// Módulo puro: recebe as visitas e a data de hoje, devolve os números. Sem
// banco e sem fuso escondido — quem chama passa o "hoje".

export type VisitaHistorico = {
  id: string;
  data: Date;
  /** agendada | realizada | nao_realizada */
  status: string;
  observacao: string | null;
};

export type ResumoVisitas = {
  /** Visitas que aconteceram. É o número que o vendedor chama de "visitas". */
  realizadas: number;
  /** Ainda no futuro (ou no dia, sem sinalizar). */
  agendadas: number;
  /** Marcadas como não realizadas. */
  naoRealizadas: number;
  /** A última que aconteceu. */
  ultima: Date | null;
  /** Dias inteiros desde a última realizada. 0 = hoje. null = nunca visitado. */
  diasDesdeUltima: number | null;
  /** A próxima agendada, se houver. */
  proxima: Date | null;
};

const DIA_MS = 86_400_000;

/** Meia-noite no fuso de Brasília, para a diferença ser em DIAS de calendário. */
function diaDeBrasilia(d: Date): number {
  const iso = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
  return Date.parse(`${iso}T00:00:00Z`);
}

/**
 * Dias inteiros entre duas datas, contados por DIA DE CALENDÁRIO.
 *
 * Visita ontem às 17h e agora são 9h da manhã: são 16 horas de diferença, mas
 * a resposta certa para o vendedor é "1 dia", não "0". Por isso a conta é entre
 * as meia-noites, e não entre os instantes.
 */
export function diasEntre(de: Date, ate: Date): number {
  return Math.round((diaDeBrasilia(ate) - diaDeBrasilia(de)) / DIA_MS);
}

export function resumoDeVisitas(visitas: VisitaHistorico[], hoje: Date = new Date()): ResumoVisitas {
  const realizadas = visitas.filter((v) => v.status === "realizada");
  const agendadas = visitas.filter((v) => v.status === "agendada");

  // A mais recente das realizadas — sem supor que a lista veio ordenada.
  let ultima: Date | null = null;
  for (const v of realizadas) if (!ultima || v.data > ultima) ultima = v.data;

  // A próxima agendada é a mais PRÓXIMA no futuro, não a mais distante.
  let proxima: Date | null = null;
  for (const v of agendadas) {
    if (v.data < hoje) continue;
    if (!proxima || v.data < proxima) proxima = v.data;
  }

  return {
    realizadas: realizadas.length,
    agendadas: agendadas.length,
    naoRealizadas: visitas.filter((v) => v.status === "nao_realizada").length,
    ultima,
    diasDesdeUltima: ultima ? Math.max(0, diasEntre(ultima, hoje)) : null,
    proxima,
  };
}

/** "hoje", "ontem", "faz 12 dias", "faz 3 meses" — como se fala, não em número cru. */
export function textoDiasDesde(dias: number | null): string {
  if (dias == null) return "nunca visitado";
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `faz ${dias} dias`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `faz ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(dias / 365);
  const resto = Math.round((dias % 365) / 30);
  if (!resto) return `faz ${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `faz ${anos}a ${resto}m`;
}

/** Dia, mês e ano — o formato que o vendedor pediu. */
export function dataDaVisita(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * As visitas agrupadas por ano, da mais recente para a mais antiga.
 *
 * Um cliente de carteira antiga junta dezenas de visitas; listar tudo numa
 * lista corrida não deixa ver nada. Por ano, o vendedor enxerga o ritmo: seis
 * em 2025, uma em 2026.
 */
export function visitasPorAno(visitas: VisitaHistorico[]): { ano: number; visitas: VisitaHistorico[] }[] {
  const mapa = new Map<number, VisitaHistorico[]>();
  for (const v of visitas) {
    const ano = Number(v.data.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 4));
    const lista = mapa.get(ano);
    if (lista) lista.push(v);
    else mapa.set(ano, [v]);
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([ano, vs]) => ({ ano, visitas: vs.sort((a, b) => b.data.getTime() - a.data.getTime()) }));
}
