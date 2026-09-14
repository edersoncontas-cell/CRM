// Metas e cotas: transforma a meta anual em ritmo semanal e diz, toda
// segunda-feira, o que precisa acontecer para bater o mês e o ano. Usa as
// taxas REAIS do vendedor nos últimos 12 meses (visitas por venda, taxa de
// conversão) para calcular quantas visitas e negociações por semana são
// necessárias — com valores de segurança quando ainda não há histórico.

import { db } from "@/lib/db";
import { lerParametros } from "@/lib/parametros";
import { inicioDoDiaBrasilia, diaSemanaBrasilia } from "@/lib/utils";

const DIA = 24 * 60 * 60 * 1000;
const SEMANA = 7 * DIA;

export type RitmoMetas = {
  ano: number;
  metaAnual: number;
  metaMes: number;
  metaTrimestre: number;
  vendasAno: number;
  vendasMes: number;
  vendasTrimestre: number;
  esperadoAteHoje: number;     // meta anual × fração do ano decorrida
  desvio: number;              // vendasAno − esperadoAteHoje (negativo = atrasado)
  desvioPct: number;           // desvio / esperadoAteHoje
  situacao: "adiantado" | "no_ritmo" | "atrasado";
  faltamAno: number;
  faltamMes: number;
  semanasRestantesAno: number;
  semanasRestantesMes: number;
  vendasPorSemanaNecessarias: number;
  // Taxas históricas (12 meses) e o que elas exigem por semana.
  taxaConversao: number;       // ganhas / (ganhas + perdidas)
  visitasPorVenda: number;
  negociacoesPorSemanaNecessarias: number;
  visitasPorSemanaNecessarias: number;
  visitasSemana: number;       // realizadas/agendadas nesta semana
  negociacoesSemana: number;   // criadas nesta semana
  metaVisitasSemana: number;   // parâmetro
  metaNegociosSemana: number;  // parâmetro
  previsaoAno: number;         // no ritmo atual, quantas máquinas fecha no ano
  resumo: string;              // frase para o Dashboard / briefing
};

export async function calcularRitmoMetas(agora = new Date()): Promise<RitmoMetas> {
  const p = await lerParametros();
  const ano = agora.getFullYear();
  const inicioAno = new Date(`${ano}-01-01T00:00:00-03:00`);
  const fimAno = new Date(`${ano + 1}-01-01T00:00:00-03:00`);
  const mes = agora.getMonth();
  const inicioMes = new Date(`${ano}-${String(mes + 1).padStart(2, "0")}-01T00:00:00-03:00`);
  const fimMes = mes === 11 ? fimAno : new Date(`${ano}-${String(mes + 2).padStart(2, "0")}-01T00:00:00-03:00`);
  const trimestre = Math.floor(mes / 3);
  const inicioTri = new Date(`${ano}-${String(trimestre * 3 + 1).padStart(2, "0")}-01T00:00:00-03:00`);
  const fimTri = trimestre === 3 ? fimAno : new Date(`${ano}-${String(trimestre * 3 + 4).padStart(2, "0")}-01T00:00:00-03:00`);
  const dozeMeses = new Date(agora.getTime() - 365 * DIA);
  const deltaSegunda = (diaSemanaBrasilia(agora) + 6) % 7;
  const inicioSemana = inicioDoDiaBrasilia(agora, -deltaSegunda);
  const fimSemana = new Date(inicioSemana.getTime() + SEMANA);

  const [vendasAno, vendasMes, vendasTri, ganhas12, perdidas12, visitas12, vendas12, visitasSemana, negociacoesSemana] = await Promise.all([
    db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: inicioAno, lt: fimAno } } }),
    db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: inicioMes, lt: fimMes } } }),
    db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: inicioTri, lt: fimTri } } }),
    db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: dozeMeses } } }),
    db.negociacao.count({ where: { status: "perdida", atualizadoEm: { gte: dozeMeses } } }),
    db.visita.count({ where: { data: { gte: dozeMeses, lte: agora } } }),
    db.negociacao.count({ where: { status: "ganha", faturadoEm: { gte: dozeMeses } } }),
    db.visita.count({ where: { data: { gte: inicioSemana, lt: fimSemana } } }),
    db.negociacao.count({ where: { criadoEm: { gte: inicioSemana, lt: fimSemana } } }),
  ]);

  const metaAnual = p.metaAnualVendas;
  const metaMes = metaAnual / 12;
  const metaTrimestre = metaAnual / 4;
  const fracaoAno = Math.min(1, Math.max(0, (agora.getTime() - inicioAno.getTime()) / (fimAno.getTime() - inicioAno.getTime())));
  const esperadoAteHoje = metaAnual * fracaoAno;
  const desvio = vendasAno - esperadoAteHoje;
  const desvioPct = esperadoAteHoje > 0 ? desvio / esperadoAteHoje : 0;
  const situacao: RitmoMetas["situacao"] = esperadoAteHoje < 1 ? "no_ritmo" : desvioPct >= 0.1 ? "adiantado" : desvioPct <= -0.15 ? "atrasado" : "no_ritmo";

  const faltamAno = Math.max(0, metaAnual - vendasAno);
  const faltamMes = Math.max(0, Math.ceil(metaMes) - vendasMes);
  const semanasRestantesAno = Math.max(1, (fimAno.getTime() - agora.getTime()) / SEMANA);
  const semanasRestantesMes = Math.max(0.5, (fimMes.getTime() - agora.getTime()) / SEMANA);
  const vendasPorSemanaNecessarias = faltamAno / semanasRestantesAno;

  // Taxas com piso de segurança: sem histórico, assume 25% de conversão e 4
  // visitas por venda (números típicos do nicho, ver Academia).
  const encerradas = ganhas12 + perdidas12;
  const taxaConversao = encerradas >= 5 ? ganhas12 / encerradas : 0.25;
  const visitasPorVenda = vendas12 >= 3 && visitas12 > 0 ? visitas12 / vendas12 : 4;
  const negociacoesPorSemanaNecessarias = vendasPorSemanaNecessarias / Math.max(0.05, taxaConversao);
  const visitasPorSemanaNecessarias = vendasPorSemanaNecessarias * visitasPorVenda;

  const semanasDecorridas = Math.max(1, (agora.getTime() - inicioAno.getTime()) / SEMANA);
  const previsaoAno = Math.round(vendasAno + (vendasAno / semanasDecorridas) * semanasRestantesAno);

  const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("pt-BR");
  const resumo =
    faltamAno === 0
      ? `Meta do ano batida: ${vendasAno} de ${metaAnual}. Agora é margem.`
      : `Faltam ${faltamAno} máquina(s) em ${Math.ceil(semanasRestantesAno)} semana(s): ${r1(vendasPorSemanaNecessarias)} venda/semana, o que pede cerca de ${Math.ceil(visitasPorSemanaNecessarias)} visita(s) e ${Math.ceil(negociacoesPorSemanaNecessarias)} negociação(ões) nova(s) por semana no seu histórico.`;

  return {
    ano, metaAnual, metaMes, metaTrimestre,
    vendasAno, vendasMes, vendasTrimestre: vendasTri,
    esperadoAteHoje, desvio, desvioPct, situacao,
    faltamAno, faltamMes, semanasRestantesAno, semanasRestantesMes,
    vendasPorSemanaNecessarias,
    taxaConversao, visitasPorVenda,
    negociacoesPorSemanaNecessarias, visitasPorSemanaNecessarias,
    visitasSemana, negociacoesSemana,
    metaVisitasSemana: p.metaVisitasSemana,
    metaNegociosSemana: p.metaNegociosSemana,
    previsaoAno,
    resumo,
  };
}
