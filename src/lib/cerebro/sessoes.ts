// Mapa das sessões do CRM — é a "anatomia" que o Cérebro enxerga: cada
// sessão é um nó ligado ao centro, com os sub-nós que explicam o que ela faz.
// Módulo PURO (sem banco): a Central Inteligente desenha o grafo a partir
// daqui e só pede ao banco a CONTAGEM de cada sessão.
//
// Uma sessão nova do CRM entra aqui e aparece no grafo, no radar de inovação
// e no relatório sem precisar mexer no desenho.

export type SessaoCerebro = {
  id: string;
  nome: string;
  href: string;
  cor: string;
  // O que essa sessão faz pelo vendedor (aparece ao tocar no nó).
  papel: string;
  // Sub-nós: as funções dentro da sessão (os pontinhos da ponta da sinapse).
  ramos: string[];
  // Grupo do menu, para o grafo nascer organizado.
  grupo: "vendas" | "relacionamento" | "inteligencia" | "operacao";
};

export const SESSOES: SessaoCerebro[] = [
  {
    id: "negociacoes", nome: "Negociações", href: "/negociacoes", cor: "#ffcb2d", grupo: "vendas",
    papel: "O funil: cada card é uma máquina em jogo, da primeira conversa ao faturamento.",
    ramos: ["Funil por coluna", "Valor ponderado", "Proposta em PDF", "Usada na troca", "Faturamento"],
  },
  {
    id: "orientador", nome: "Orientador de Vendas", href: "/orientador", cor: "#38bdf8", grupo: "inteligencia",
    papel: "Lê cada conversa do WhatsApp e diz o que fazer a seguir com aquele cliente.",
    ramos: ["Temperatura", "Probabilidade", "Próxima ação", "Objeções", "Melhor resposta"],
  },
  {
    id: "whatsapp", nome: "WhatsApp", href: "/atendimento", cor: "#34d399", grupo: "relacionamento",
    papel: "Todas as conversas com clientes, com mídia, transcrição de áudio e rascunhos da IA.",
    ramos: ["Conversas", "Áudio transcrito", "Respostas prontas", "Envio em lote", "Relatório de conversas"],
  },
  {
    id: "clientes", nome: "Clientes", href: "/clientes", cor: "#a78bfa", grupo: "relacionamento",
    papel: "A carteira: cadastro, cidade, aniversário, frota e a linha do tempo de cada um.",
    ramos: ["Cadastro", "Linha do tempo", "Google Contatos", "Duplicados", "Aniversários"],
  },
  {
    id: "visitas", nome: "Visitas", href: "/visitas", cor: "#fb923c", grupo: "operacao",
    papel: "A agenda de campo: quem visitar, em que cidade e em que dia, com mapa do ES.",
    ramos: ["Calendário", "Mapa por cidade", "Confirmação", "Abordagem por cidade", "Google Agenda"],
  },
  {
    id: "marketing", nome: "Marketing", href: "/marketing", cor: "#f472b6", grupo: "relacionamento",
    papel: "Posts e campanhas criados com o Gemini: legenda e arte, do dia a dia à promoção.",
    ramos: ["Post do dia", "Semanal", "Mensal", "Campanha", "Arte com IA"],
  },
  {
    id: "alertas", nome: "Central de Alertas", href: "/alertas", cor: "#f87171", grupo: "inteligencia",
    papel: "O que não pode passar batido hoje: cliente esfriando, pós-venda, pendência.",
    ramos: ["Aguardando resposta", "Pós-venda", "Cadências", "Sistema"],
  },
  {
    id: "demandas", nome: "Demandas", href: "/pipeline", cor: "#22d3ee", grupo: "operacao",
    papel: "A lista única de tarefas do vendedor, com as que a IA cria sozinha.",
    ramos: ["Hoje", "Atrasadas", "Por voz", "Automáticas"],
  },
  {
    id: "financeiro", nome: "Financeiro", href: "/financeiro", cor: "#4ade80", grupo: "vendas",
    papel: "Comissões, faturamento e o valor que já passou pela sua mão no ano.",
    ramos: ["Comissões", "Faturadas", "Previsão", "Valor por máquina"],
  },
  {
    id: "maquinas", nome: "Fichas Técnicas", href: "/maquinas/fichas", cor: "#fde047", grupo: "vendas",
    papel: "O catálogo: New Holland e Dynapac com especificação, aplicação e argumento de venda.",
    ramos: ["Especificações", "Aplicações", "Fotos", "Comparativo"],
  },
  {
    id: "academia", nome: "Academia de Vendas", href: "/academia", cor: "#818cf8", grupo: "inteligencia",
    papel: "Treinamento: método, objeções, fechamento e simulação com a IA.",
    ramos: ["Trilha", "Provas", "Treino com IA", "Dicas do dia"],
  },
  {
    id: "dashboard", nome: "Dashboard", href: "/dashboard", cor: "#2ee6ff", grupo: "vendas",
    papel: "O placar do ano: meta, ritmo, mapa de vendas e ranking de clientes.",
    ramos: ["Meta e ritmo", "Mapa do ES", "Ranking", "Evolução"],
  },
];

export const SESSOES_POR_ID = new Map(SESSOES.map((s) => [s.id, s]));

export type GrupoSessao = SessaoCerebro["grupo"];

export const ROTULO_GRUPO: Record<GrupoSessao, string> = {
  vendas: "Vendas",
  relacionamento: "Relacionamento",
  inteligencia: "Inteligência",
  operacao: "Operação",
};

// Posição de cada nó em volta do Cérebro (coordenadas 0–1000 do SVG). Os nós
// ficam distribuídos no círculo, agrupados por área, para o desenho nascer
// organizado em vez de aleatório — e igual em toda recarga da página.
export function posicoesDoGrafo(sessoes: SessaoCerebro[] = SESSOES): Map<string, { x: number; y: number; angulo: number }> {
  const centro = { x: 500, y: 500 };
  const ordem: GrupoSessao[] = ["vendas", "relacionamento", "inteligencia", "operacao"];
  const ordenadas = [...sessoes].sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo));
  const mapa = new Map<string, { x: number; y: number; angulo: number }>();
  const n = ordenadas.length || 1;
  ordenadas.forEach((s, i) => {
    const angulo = (i / n) * Math.PI * 2 - Math.PI / 2;
    // Dois anéis alternados: o grafo fica com profundidade em vez de um
    // círculo perfeito (e os rótulos param de se sobrepor). O raio menor
    // deixa espaço nas bordas para o nome da sessão caber inteiro.
    const raio = i % 2 === 0 ? 268 : 330;
    mapa.set(s.id, {
      x: Math.round(centro.x + Math.cos(angulo) * raio),
      y: Math.round(centro.y + Math.sin(angulo) * raio),
      angulo,
    });
  });
  return mapa;
}

// Posição dos sub-nós (ramos) de uma sessão: abrem em leque para fora,
// afastando-se do centro. Devolve também o ângulo, para o rótulo de cada
// ponta sair para o lado de fora e não cair por cima do nome da sessão.
export function posicoesDosRamos(
  sessao: SessaoCerebro,
  posicao: { x: number; y: number; angulo: number }
): { rotulo: string; x: number; y: number; angulo: number }[] {
  const total = sessao.ramos.length || 1;
  const abertura = Math.PI / 1.35;
  return sessao.ramos.map((rotulo, i) => {
    const desvio = total === 1 ? 0 : (i / (total - 1) - 0.5) * abertura;
    const ang = posicao.angulo + desvio;
    const raio = 118 + (i % 2) * 46;
    return {
      rotulo,
      x: Math.round(posicao.x + Math.cos(ang) * raio),
      y: Math.round(posicao.y + Math.sin(ang) * raio),
      angulo: ang,
    };
  });
}
