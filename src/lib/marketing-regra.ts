// Regras PURAS da sessão de Marketing (posts criados com o Gemini): tipos de
// post, temas sugeridos e os prompts de legenda e de arte. Sem banco e sem
// rede — dá para testar e garante que o texto nunca prometa preço, condição
// ou prazo que o vendedor não autorizou.

export type TipoPost = "diario" | "semanal" | "mensal" | "campanha" | "promocao";

export const TIPOS_POST: { id: TipoPost; nome: string; descricao: string; cadencia: string }[] = [
  { id: "diario", nome: "Post do dia", descricao: "Conteúdo curto para manter presença: dica de operação, bastidor, máquina em obra.", cadencia: "todo dia útil" },
  { id: "semanal", nome: "Post da semana", descricao: "Assunto mais encorpado: aplicação de uma máquina, comparativo honesto, caso de cliente.", cadencia: "1x por semana" },
  { id: "mensal", nome: "Post do mês", descricao: "Balanço, novidade da linha, tendência do setor na região.", cadencia: "1x por mês" },
  { id: "campanha", nome: "Campanha", descricao: "Sequência com um objetivo (feira, lançamento, safra do café, obra pública).", cadencia: "quando houver" },
  { id: "promocao", nome: "Promoção", descricao: "Condição especial de verdade, com o que foi autorizado pela concessionária.", cadencia: "quando houver" },
];

export type CanalPost = "instagram" | "facebook" | "whatsapp" | "outro";

export const CANAIS: { id: CanalPost; nome: string; limite: number }[] = [
  { id: "instagram", nome: "Instagram", limite: 2200 },
  { id: "facebook", nome: "Facebook", limite: 2000 },
  { id: "whatsapp", nome: "WhatsApp (status/cliente)", limite: 700 },
  { id: "outro", nome: "Outro", limite: 2000 },
];

// Sugestões de tema por tipo — o vendedor escolhe uma ou escreve a dele.
export const TEMAS_SUGERIDOS: Record<TipoPost, string[]> = {
  diario: [
    "Dica de operação que economiza diesel na obra",
    "Erro comum na compactação de base e como evitar",
    "Máquina certa para cada etapa do serviço",
    "Cuidado diário que dobra a vida do equipamento",
    "Bastidor: máquina entregue nesta semana",
  ],
  semanal: [
    "Escavadeira x retroescavadeira: quando cada uma paga a conta",
    "Custo por hora: o número que decide a compra",
    "Rolo de solo liso (D) ou pé-de-carneiro (PD): como escolher",
    "Caso de cliente: obra que rendeu mais com a máquina certa",
    "Financiamento de máquina: o que o banco olha",
  ],
  mensal: [
    "Balanço do mês na região e o que vem pela frente",
    "Tendência: o que muda na construção no sul do ES",
    "Novidade da linha e por que ela importa aqui",
    "Pós-venda: o que o cliente ganha com assistência perto",
  ],
  campanha: [
    "Feira/exposição do setor na região",
    "Safra do café: preparo de terreiro e estrada rural",
    "Obra pública: licitação e prazo de entrega",
    "Semana da máquina usada com garantia",
  ],
  promocao: [
    "Condição especial de financiamento autorizada",
    "Máquina seminova com garantia",
    "Pacote de entrega rápida",
  ],
};

export function limiteDoCanal(canal: CanalPost): number {
  return CANAIS.find((c) => c.id === canal)?.limite ?? 2000;
}

export type PedidoPost = {
  tipo: TipoPost;
  tema: string;
  canal: CanalPost;
  maquina?: string | null;
  // Texto livre: o que o vendedor quer destacar nesta peça.
  instrucoes?: string | null;
  vendedor: string;
  empresa: string;
  marcas: string;
  regiao: string;
};

// Prompt da LEGENDA. A regra de ouro: nada de preço, prazo ou condição que
// não tenha vindo do próprio vendedor no campo de instruções.
export function promptLegenda(p: PedidoPost): { system: string; user: string } {
  const limite = limiteDoCanal(p.canal);
  const system = `Você escreve posts de rede social para ${p.vendedor}, vendedor de máquinas pesadas da ${p.empresa} (${p.marcas}) no ${p.regiao}.
Quem lê é dono de construtora, empreiteiro, produtor rural, prefeitura e locadora — gente prática, que decide por número e por confiança.

Como escrever:
- Comece com uma frase que prende quem está passando o dedo na tela. Sem "bom dia a todos".
- 3 a 6 frases curtas. Português do Brasil, direto, de quem entende de obra.
- Fale de aplicação, produtividade, custo por hora, disponibilidade e assistência — não de adjetivo vazio.
- Termine com um convite claro para chamar no WhatsApp.
- No máximo ${limite} caracteres, incluindo as hashtags.

Proibido:
- Inventar preço, parcela, taxa, prazo de entrega, desconto ou campanha. Só use o que estiver nas instruções do vendedor.
- Inventar especificação técnica (peso, potência, capacidade). Na dúvida, fale do benefício, não do número.
- Depreciar concorrente pelo nome.
- Emoji em excesso: no máximo dois, e só se combinar com o assunto.

Devolva SOMENTE um JSON válido:
{"legenda":"<texto do post>","hashtags":"<5 a 8 hashtags separadas por espaço, começando com #>","ideiaDeArte":"<1 frase descrevendo a imagem ideal para este post>"}`;

  const user = [
    `Tipo de post: ${TIPOS_POST.find((t) => t.id === p.tipo)?.nome ?? p.tipo}.`,
    `Tema: ${p.tema}.`,
    `Canal: ${CANAIS.find((c) => c.id === p.canal)?.nome ?? p.canal}.`,
    p.maquina ? `Máquina em destaque: ${p.maquina}.` : "",
    p.instrucoes?.trim() ? `O vendedor pediu: ${p.instrucoes.trim()}` : "",
  ].filter(Boolean).join("\n");

  return { system, user };
}

// Prompt da ARTE (Gemini imagem). Mantém a identidade visual e evita texto
// escrito pela IA na imagem, que quase sempre sai errado.
export function promptArtePost(p: PedidoPost, ideiaDeArte?: string | null, quantasReferencias = 0): string {
  const cenario = p.regiao.toLowerCase().includes("esp") ? "região serrana e litorânea do sul do Espírito Santo" : p.regiao;
  return [
    "Fotografia publicitária profissional de máquina pesada de construção em operação.",
    // Com anexo, a instrução tem que vir ANTES do resto: senão o modelo trata
    // a imagem como enfeite e desenha uma máquina genérica no lugar da dele.
    quantasReferencias > 0
      ? `Use ${quantasReferencias === 1 ? "a imagem anexada" : `as ${quantasReferencias} imagens anexadas`} como BASE: a máquina, as cores e as marcas que aparecem nela devem ser mantidas fielmente. Não troque o modelo da máquina nem invente outro equipamento.`
      : "",
    ideiaDeArte?.trim() ? `Cena: ${ideiaDeArte.trim()}.` : `Cena ligada ao tema: ${p.tema}.`,
    p.maquina ? `Equipamento em destaque: ${p.maquina}.` : "",
    `Ambiente: obra real no Brasil, ${cenario}, luz natural do fim da tarde.`,
    "Composição limpa, com espaço vazio no topo para o texto ser colocado depois.",
    "Cores fortes e contraste alto, aspecto de catálogo de fabricante.",
    // Com anexo, proibir logotipo brigaria com "mantenha as marcas da imagem
    // anexada" — a marca da máquina dele tem que continuar lá. Sem anexo, a
    // proibição vale inteira, para não inventar marca nenhuma.
    quantasReferencias > 0
      ? "NÃO escreva nenhum texto, letra, número ou marca d'água na imagem — a única marca permitida é a que já aparece na máquina anexada."
      : "NÃO escreva nenhum texto, letra, número, logotipo ou marca d'água na imagem.",
    "Nada de pessoas com rosto reconhecível.",
  ].filter(Boolean).join(" ");
}

// Validação do que volta da IA (a tela nunca salva post vazio).
export function normalizarLegenda(raw: string, canal: CanalPost): { legenda: string; hashtags: string; ideiaDeArte: string } {
  const vazio = { legenda: "", hashtags: "", ideiaDeArte: "" };
  const ini = raw.indexOf("{");
  const fim = raw.lastIndexOf("}");
  if (ini === -1 || fim === -1) {
    // A IA respondeu em texto puro: aproveita como legenda mesmo assim.
    const texto = raw.trim().slice(0, limiteDoCanal(canal));
    return texto ? { ...vazio, legenda: texto } : vazio;
  }
  try {
    const o = JSON.parse(raw.slice(ini, fim + 1)) as Record<string, unknown>;
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const hashtags = s(o.hashtags, 300)
      .split(/\s+/)
      .filter((h) => h.startsWith("#") && h.length > 2)
      .slice(0, 8)
      .join(" ");
    return {
      legenda: s(o.legenda, limiteDoCanal(canal)),
      hashtags,
      ideiaDeArte: s(o.ideiaDeArte, 300),
    };
  } catch {
    return vazio;
  }
}

// Texto final que vai para a área de transferência / WhatsApp.
export function textoParaPublicar(legenda: string, hashtags: string): string {
  return [legenda.trim(), hashtags.trim()].filter(Boolean).join("\n\n");
}
