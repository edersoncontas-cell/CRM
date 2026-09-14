// Tipos da Trilha de Formação da Academia de Vendas.
// Cada módulo (nível) tem objetivos, 6 aulas, uma prova final e leituras.
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
  | { tipo: "exercicio"; titulo?: string; texto: string };

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
