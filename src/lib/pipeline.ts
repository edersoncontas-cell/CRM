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

// ── Papel das colunas ───────────────────────────────────────────────────────
// Cada coluna do funil tem um PAPEL gravado no banco (ColunaFunil.papel), que
// diz o que acontece com a negociação ao entrar nela. O título é livre — o
// usuário renomeia à vontade sem quebrar Financeiro, Dashboard ou pós-venda.
// Colunas antigas sem papel gravado caem no reconhecimento por palavra
// (compatibilidade), mas a migração v10 preenche todas.
export type PapelColuna = "em_negociacao" | "banco" | "confirmada" | "faturado" | "perdida";

export const PAPEIS_COLUNA: { id: PapelColuna; label: string; descricao: string; probabilidadePadrao: number }[] = [
  { id: "em_negociacao", label: "Oportunidade", descricao: "Cliente falou com você, ou você falou com ele, e apareceu chance de negócio. Nasce da conversa do WhatsApp ou na mão.", probabilidadePadrao: 20 },
  { id: "banco", label: "Proposta", descricao: "Já tem proposta: para o cliente tentar crédito no banco dele, ou no nosso banco de fábrica (Banco CNH / BCNH).", probabilidadePadrao: 50 },
  { id: "confirmada", label: "Negociação", descricao: "Crédito aprovado, ou cliente na iminência de fechar. É onde o termômetro está muito quente.", probabilidadePadrao: 80 },
  { id: "faturado", label: "Faturado", descricao: "Máquina faturada: entra no Financeiro, no Dashboard e no pós-venda.", probabilidadePadrao: 100 },
  { id: "perdida", label: "Venda perdida", descricao: "Negociação encerrada sem venda. Pede o motivo, e vive fora do funil, na página de Vendas Perdidas.", probabilidadePadrao: 0 },
];

// ── O FUNIL CANÔNICO ────────────────────────────────────────────────────────
//
// Quatro colunas no quadro, nesta ordem, e a perdida fora dele.
//
// O TÍTULO é o que o vendedor lê e o que fica gravado em Negociacao.estagio;
// o PAPEL é o que o código consulta. Por isso renomear uma coluna exige migrar
// os estágios junto (ver migrations.ts v42) — e por isso nada aqui é lido por
// nome em outro lugar do sistema.
export const FUNIL_CANONICO: { papel: PapelColuna; titulo: string; ordem: number; probabilidade: number; noQuadro: boolean }[] = [
  { papel: "em_negociacao", titulo: "OPORTUNIDADE", ordem: 1, probabilidade: 20,  noQuadro: true },
  { papel: "banco",         titulo: "PROPOSTA",     ordem: 2, probabilidade: 50,  noQuadro: true },
  { papel: "confirmada",    titulo: "NEGOCIAÇÃO",   ordem: 3, probabilidade: 80,  noQuadro: true },
  { papel: "faturado",      titulo: "FATURADO",     ordem: 4, probabilidade: 100, noQuadro: true },
  // Sai do quadro: tem página própria (/vendas-perdidas). A coluna continua
  // existindo porque é o destino de quem é marcado como perdido.
  { papel: "perdida",       titulo: "VENDA PERDIDA", ordem: 5, probabilidade: 0,  noQuadro: false },
];

// Paleta "Sóbrio": o card fica neutro e a cor aparece só no trilho da coluna,
// na barra do topo e no contador. Cada papel tem sua variável CSS, definida
// nos dois temas em globals.css — quando o tema claro/escuro do CRM inteiro
// for feito, esta parte já está pronta e não precisa ser reescrita.
//
// Os tons NÃO foram escolhidos no olho: passaram no validador de daltonismo e
// de contraste contra o fundo escuro e contra o claro. Combinações mais bonitas
// foram descartadas por isso — azul com violeta lado a lado, por exemplo, fica
// praticamente idêntico para daltonismo vermelho-verde (ΔE 1,9).
export const VAR_COR_PAPEL: Record<PapelColuna, string> = {
  em_negociacao: "var(--funil-oportunidade)",
  banco:         "var(--funil-proposta)",
  confirmada:    "var(--funil-negociacao)",
  faturado:      "var(--funil-faturado)",
  perdida:       "var(--funil-perdida)",
};

export function corDaColuna(col: ColunaComPapel): string {
  return VAR_COR_PAPEL[papelDaColuna(col)];
}

export function rotuloPapel(papel: string | null | undefined): string {
  return PAPEIS_COLUNA.find((p) => p.id === papel)?.label ?? "Em negociação";
}

// Reconhecimento por palavra: só para colunas ainda sem papel gravado.
export function papelPorTitulo(titulo: string): PapelColuna {
  const t = titulo.toLowerCase();
  if (t.includes("perdid")) return "perdida";
  if (t.includes("faturad")) return "faturado";
  if (t.includes("confirm") || t.includes("aprovad") || t.includes("vendid") || t.includes("ganh")) return "confirmada";
  if (t.includes("banco") || t.includes("bcnh")) return "banco";
  return "em_negociacao";
}

export type ColunaComPapel = { titulo: string; papel?: string | null; probabilidade?: number | null };

export function papelDaColuna(col: ColunaComPapel): PapelColuna {
  const p = col.papel as PapelColuna | null | undefined;
  return p && PAPEIS_COLUNA.some((x) => x.id === p) ? p : papelPorTitulo(col.titulo);
}

export function probabilidadeDaColuna(col: ColunaComPapel): number {
  if (typeof col.probabilidade === "number") return Math.max(0, Math.min(100, col.probabilidade));
  return PAPEIS_COLUNA.find((p) => p.id === papelDaColuna(col))?.probabilidadePadrao ?? 50;
}

// Motivos de perda em lista (antes era texto livre, impossível de analisar).
export const MOTIVOS_PERDA: { id: string; label: string }[] = [
  { id: "preco", label: "Preço / condição" },
  { id: "concorrente", label: "Comprou do concorrente" },
  { id: "credito", label: "Crédito negado ou financiamento não saiu" },
  { id: "adiou", label: "Adiou a compra" },
  { id: "usada", label: "Comprou usada" },
  { id: "sem_retorno", label: "Parou de responder" },
  { id: "prazo", label: "Prazo de entrega" },
  { id: "outro", label: "Outro" },
];

export function rotuloMotivoPerda(motivo: string | null | undefined): string {
  if (!motivo) return "Não informado";
  const [id, ...resto] = motivo.split(":");
  const item = MOTIVOS_PERDA.find((m) => m.id === id.trim());
  if (!item) return motivo;
  const nota = resto.join(":").trim();
  return nota ? `${item.label} · ${nota}` : item.label;
}

// Categoria usada por Dashboard, Funil e Orientador para contagens.
//
// "negociacao" é a coluna NEGOCIAÇÃO: crédito aprovado ou cliente na iminência
// de fechar. É uma fase ABERTA — o negócio ainda não aconteceu. Ela existe
// separada de "confirmada" (que agora significa faturado, venda de verdade)
// justamente porque misturar as duas contaria como vendido o que ainda pode
// cair. Só o FATURADO é venda.
export type CategoriaColuna = "banco" | "negociacao" | "confirmada" | "perdida" | "em_negociacao" | "outro";

// As fases em que a negociação ainda está de pé. Regra única, porque Dashboard,
// Funil e Central de alertas contavam isso cada um por conta — e quando a
// NEGOCIAÇÃO entrou no funil, as três teriam que lembrar de somar a coluna
// nova. Uma esqueceria.
export function ehFunilAberto(cat: CategoriaColuna): boolean {
  return cat === "em_negociacao" || cat === "banco" || cat === "negociacao";
}

// Constrói o categorizador a partir das colunas REAIS do funil (ColunaFunil).
// Negociações "órfãs" (estagio que não bate com nenhuma coluna atual, sobra de
// renomeações/exclusões antigas) caem em "outro" e não inflam contagens.
export function criarCategorizadorColunas(colunas: ColunaComPapel[]) {
  const porTitulo = new Map<string, PapelColuna>();
  for (const c of colunas) porTitulo.set(c.titulo, papelDaColuna(c));

  return function categorizarColunaPorTitulo(titulo: string): CategoriaColuna {
    const papel = porTitulo.get(titulo) ?? (porTitulo.size === 0 ? papelPorTitulo(titulo) : null);
    if (!papel) {
      // Estágio sem coluna: só as palavras terminais ainda contam (histórico).
      const t = titulo.toLowerCase();
      if (t.includes("perdid")) return "perdida";
      if (t.includes("faturad") || t.includes("confirm") || t.includes("aprovad") || t.includes("vendid") || t.includes("ganh")) return "confirmada";
      return "outro";
    }
    if (papel === "perdida") return "perdida";
    // Só FATURADO é venda. A NEGOCIAÇÃO (papel "confirmada") é fase aberta:
    // crédito aprovado ainda não é máquina faturada, e contar como vendido
    // inflaria o Dashboard e o Financeiro com negócio que ainda pode cair.
    if (papel === "faturado") return "confirmada";
    if (papel === "confirmada") return "negociacao";
    if (papel === "banco") return "banco";
    return "em_negociacao";
  };
}

// Valor ponderado do funil: soma de valor × probabilidade da coluna, só das
// negociações abertas. É a previsão "honesta" de quanto vai fechar.
export function valorPonderado(
  negociacoes: { estagio: string; status: string; valor: number | null }[],
  colunas: ColunaComPapel[]
): number {
  const prob = new Map<string, number>();
  for (const c of colunas) prob.set(c.titulo, probabilidadeDaColuna(c) / 100);
  let total = 0;
  for (const n of negociacoes) {
    if (n.status !== "aberta") continue;
    const p = prob.get(n.estagio);
    if (p == null) continue;
    total += (n.valor ?? 0) * p;
  }
  return Math.round(total);
}
