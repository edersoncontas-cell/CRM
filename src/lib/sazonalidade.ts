// Radar de sazonalidade para CONSTRUÇÃO no sul do Espírito Santo.
// Ajuda a saber a melhor época para ofertar cada tipo de máquina.
// Baseado em: período de chuvas (verão), ciclo de obras públicas/licitações,
// empenho de orçamento no fim do ano e janelas de crédito (Finame/BNDES).

export interface RecomendacaoMes {
  mes: string;
  estacao: "chuvas" | "seca" | "transicao";
  foco: string;
  dica: string;
  oportunidades: string[]; // categorias de máquina para empurrar
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// 0=jan ... 11=dez
const CALENDARIO: Omit<RecomendacaoMes, "mes">[] = [
  { estacao: "chuvas", foco: "Planejamento de obras e licitações", dica: "Prefeituras montam o orçamento e abrem licitações. Hora de prospectar construtoras e órgãos públicos e posicionar proposta.", oportunidades: ["motoniveladora", "retroescavadeira"] },
  { estacao: "chuvas", foco: "Licitações em andamento", dica: "Chuvas atrapalham terraplenagem. Foque em relacionamento, demonstração e fechamento de propostas para entrega na seca.", oportunidades: ["retroescavadeira", "minicarregadeira"] },
  { estacao: "chuvas", foco: "Reta final das chuvas", dica: "Clientes começam a planejar a retomada das obras de terra. Antecipe a oferta de escavadeiras e rolos.", oportunidades: ["escavadeira", "rolo_solo"] },
  { estacao: "transicao", foco: "Início da seca — retomada das obras", dica: "Começa a melhor época para terraplenagem e pavimentação. Empurre escavadeiras, pás e rolos.", oportunidades: ["escavadeira", "pacarregadeira", "rolo_solo"] },
  { estacao: "seca", foco: "Pico de terraplenagem", dica: "Tempo seco = máquina trabalhando. Demanda alta por escavadeiras e rolos de solo. Ofereça reposição/aumento de frota.", oportunidades: ["escavadeira", "rolo_solo", "tratoresteira"] },
  { estacao: "seca", foco: "Pico de pavimentação", dica: "Época ideal para asfalto. Empurre rolos tandem e pneumáticos para pavimentadoras.", oportunidades: ["rolo_tandem", "rolo_pneumatico"] },
  { estacao: "seca", foco: "Janela de crédito (meio do ano)", dica: "Boas condições de Finame/BNDES. Use o simulador e feche financiamentos.", oportunidades: ["escavadeira", "motoniveladora"] },
  { estacao: "seca", foco: "Produção plena", dica: "Obras a todo vapor antes das chuvas. Aproveite para vender máquina de reposição e usados na troca.", oportunidades: ["escavadeira", "pacarregadeira"] },
  { estacao: "transicao", foco: "Última janela antes das chuvas", dica: "Clientes correm para concluir terraplenagem. Ofereça entrega rápida (máquina em estoque).", oportunidades: ["escavadeira", "rolo_solo"] },
  { estacao: "chuvas", foco: "Empenho de orçamento público", dica: "Prefeituras precisam usar a verba antes de virar o ano. Momento forte para vender para órgãos públicos.", oportunidades: ["motoniveladora", "retroescavadeira", "pacarregadeira"] },
  { estacao: "chuvas", foco: "Fechamento de verba do ano", dica: "Última chance de empenho. Acelere propostas para o setor público e construtoras com saldo de orçamento.", oportunidades: ["motoniveladora", "retroescavadeira"] },
  { estacao: "chuvas", foco: "Planejamento do ano seguinte", dica: "Clientes planejam compras do próximo ano. Plante a semente e agende visitas para janeiro.", oportunidades: ["escavadeira", "pacarregadeira"] },
];

export function recomendacaoMes(mesIndex: number): RecomendacaoMes {
  const i = ((mesIndex % 12) + 12) % 12;
  return { mes: MESES[i], ...CALENDARIO[i] };
}

export function calendarioAnual(): RecomendacaoMes[] {
  return MESES.map((_, i) => recomendacaoMes(i));
}

export const ESTACAO_INFO: Record<string, { rotulo: string; emoji: string; tom: "blue" | "yellow" | "green" }> = {
  chuvas: { rotulo: "Período de chuvas", emoji: "🌧️", tom: "blue" },
  seca: { rotulo: "Período seco (pico de obras)", emoji: "☀️", tom: "green" },
  transicao: { rotulo: "Transição", emoji: "⛅", tom: "yellow" },
};
