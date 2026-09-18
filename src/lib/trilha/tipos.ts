// Tipos da Trilha de Formação da Academia de Vendas.
// Cada módulo (nível) tem objetivos, aulas, uma prova final e leituras.
// Cada aula tem blocos de conteúdo de vários tipos, missão prática e quiz.

export type Bloco =
  | { tipo: "p"; texto: string; titulo?: string }
  | { tipo: "lista"; titulo?: string; itens: string[] }
  | { tipo: "script"; titulo?: string; itens: string[] }
  | { tipo: "destaque"; titulo?: string; texto: string }
  | { tipo: "caso"; titulo?: string; situacao: string; acao: string; resultado: string; licao: string }
  | { tipo: "checklist"; titulo?: string; itens: string[] }
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] }
  | { tipo: "erros"; titulo?: string; itens: string[] }
  | { tipo: "exercicio"; titulo?: string; texto: string }
  // Framework nomeado (SPIN, MEDDICC, BATNA…): de onde vem e os passos.
  | { tipo: "framework"; nome: string; origem: string; passos: string[] }
  // Diálogo anotado vendedor × cliente, com notas do professor entre as falas.
  | { tipo: "dialogo"; titulo?: string; falas: { quem: "vendedor" | "cliente" | "nota"; texto: string }[] }
  // Conta feita passo a passo (TCO, custo/hora, payback…) com conclusão.
  | { tipo: "conta"; titulo?: string; linhas: [string, string][]; conclusao: string };

// Quiz: 4 opções, uma certa. A posição da certa varia no conteúdo e ainda é
// embaralhada na tela (ver embaralharOpcoes) — decorar posição não passa.
export type Pergunta = { pergunta: string; opcoes: string[]; correta: number; explicacao: string };

export type Aula = {
  id: string;
  titulo: string;
  minutos: number;
  resumo: string;
  blocos: Bloco[];
  missao: string;
  quiz: Pergunta[];
};

export type Modulo = {
  id: string;
  nivel: number;
  titulo: string;
  tema: string;
  descricao: string;
  cor: string; // cor de destaque (hex)
  objetivos: string[];
  aulas: Aula[];
  prova: Pergunta[];
  leituras: string[];
};
