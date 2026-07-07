// Definição central das colunas do pipeline (estágios da negociação).
// Usada pelo Kanban, dashboard, gráficos e ações.

export interface EstagioDef {
  id: string;
  titulo: string;
  cor: string; // borda superior da coluna (Tailwind)
}

// Colunas das negociações ABERTAS, na ordem do funil.
// "Demandas" saiu do funil: virou coluna Trello (ver lib/demandas.ts).
export const ESTAGIOS: EstagioDef[] = [
  { id: "primeiro_contato", titulo: "Primeiro contato", cor: "border-t-sky-400" },
  { id: "visita_pendente", titulo: "Visitas pendentes", cor: "border-t-agro-400" },
  { id: "visita_realizada", titulo: "Visita realizada", cor: "border-t-emerald-400" },
  { id: "proposta_bcnh", titulo: "Proposta no BCNH", cor: "border-t-violet-400" },
  { id: "proposta_aprovada", titulo: "VENDAS CONFIRMADAS", cor: "border-t-green-500" },
];

// Coluna especial (status = perdida).
export const COL_PERDIDO: EstagioDef = {
  id: "perdido",
  titulo: "Venda perdida",
  cor: "border-t-red-400",
};

export const ESTAGIO_INICIAL = "primeiro_contato";

// Estágios "antes da visita" — usados para promover o card quando uma visita é marcada.
export const ESTAGIOS_PRE_VISITA = ["primeiro_contato"];

export const ROTULO_ESTAGIO: Record<string, string> = Object.fromEntries(
  [...ESTAGIOS, COL_PERDIDO].map((e) => [e.id, e.titulo])
);

// Compatibilidade com estágios antigos (dados criados antes da reformulação).
// "demandas"/"novo" agora caem em "primeiro_contato" (o funil não tem mais Demandas).
const LEGADO: Record<string, string> = {
  novo: "primeiro_contato",
  demandas: "primeiro_contato",
  contato: "primeiro_contato",
  proposta: "proposta_bcnh",
  negociacao: "proposta_bcnh",
  fechamento: "proposta_aprovada",
};

export function normalizarEstagio(estagio: string): string {
  return LEGADO[estagio] ?? estagio;
}

// Classifica uma coluna do funil pelo TÍTULO (Negociacao.estagio grava o
// título da coluna, não um id fixo — colunas podem ser renomeadas pelo
// usuário). Usado para os totais "EM NEGOCIAÇÃO"/"EM BANCO" do dashboard.
export type CategoriaColuna = "banco" | "confirmada" | "perdida" | "em_negociacao" | "outro";

function ehColunaTerminal(titulo: string): boolean {
  const t = titulo.toLowerCase();
  return t.includes("perdid") || t.includes("faturad") || t.includes("confirm") || t.includes("aprovad") || t.includes("vendid") || t.includes("ganho");
}

// Constrói o categorizador a partir das colunas REAIS do funil (ColunaFunil),
// não só por palavra-chave — sem isso, negociações "órfãs" (estagio que não
// bate com nenhuma coluna atual, sobra de renomeações/exclusões de coluna
// antigas) caíam todas no balde "em_negociacao" e inflavam a contagem.
export function criarCategorizadorColunas(colunas: { titulo: string }[]) {
  const abertas = colunas.filter((c) => !ehColunaTerminal(c.titulo));
  const colunaBanco = abertas.find((c) => /banco|bcnh/i.test(c.titulo));
  const titulosAbertos = new Set(abertas.map((c) => c.titulo));

  return function categorizarColunaPorTitulo(titulo: string): CategoriaColuna {
    const t = titulo.toLowerCase();
    if (t.includes("perdid")) return "perdida";
    if (t.includes("faturad") || t.includes("confirm") || t.includes("aprovad") || t.includes("vendid") || t.includes("ganho")) return "confirmada";
    if (!titulosAbertos.has(titulo)) return "outro";
    if (colunaBanco && titulo === colunaBanco.titulo) return "banco";
    return "em_negociacao";
  };
}
