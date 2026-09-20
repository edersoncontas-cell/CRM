// Quais provedores de IA o CRM tem, na ordem em que ele tenta.
//
// Pedido do vendedor: "quero, pode verificar e traga a solução e a faça."
//
// A tela mostrava só o nome do PRIMEIRO provedor ("Groq (grátis)"), o que não
// responde a pergunta que importa: e se ele cair? Com um provedor só, qualquer
// rajada de limite por minuto derruba o Orientador e o painel congela na
// leitura anterior — foi exatamente o que aconteceu, e ninguém tinha como ver
// isso na tela.
//
// Aqui fica a leitura do estado, pura e testável. Quem lê as variáveis de
// ambiente é o index.ts; este módulo só interpreta a lista.

export type ProvedorId = "gemini" | "groq" | "deepseek" | "openai" | "anthropic";

/** A ordem em que o CRM tenta. Primeiro os gratuitos — ver llmTexto. */
export const ORDEM_PROVEDORES: ProvedorId[] = ["gemini", "groq", "deepseek", "openai", "anthropic"];

export const NOME_PROVEDOR: Record<ProvedorId, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export const CHAVE_PROVEDOR: Record<ProvedorId, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** Tem camada gratuita de verdade na API (não é o app assinado). */
export const GRATUITO: Record<ProvedorId, boolean> = {
  gemini: true, groq: true, deepseek: false, openai: false, anthropic: false,
};

/** Onde pegar a chave — para quem vai ligar o provedor pela tela do CRM. */
export const ONDE_PEGAR: Record<ProvedorId, string> = {
  gemini: "aistudio.google.com/apikey",
  groq: "console.groq.com/keys",
  deepseek: "platform.deepseek.com/api_keys",
  openai: "platform.openai.com/api-keys",
  anthropic: "console.anthropic.com/settings/keys",
};

export type LinhaProvedor = {
  id: ProvedorId;
  nome: string;
  chave: string;
  configurado: boolean;
  gratuito: boolean;
  /** 1 = primeiro a ser tentado. null quando não entra na fila efetiva. */
  posicao: number | null;
  /**
   * Configurado, mas fora da fila porque é PAGO e a trava de gasto está
   * ligada. Precisa existir separado de `configurado`: sem isso a tela
   * mostrava a chave paga como "não configurada" e quem acabou de colá-la
   * concluiria, com razão, que ela não salvou.
   */
  bloqueado: boolean;
};

export type DiagnosticoIA = {
  linhas: LinhaProvedor[];
  quantos: number;
  /** Frase curta sobre o estado atual. */
  resumo: string;
  /**
   * O risco concreto, quando existe. null quando está tudo bem. É o que o
   * vendedor precisa ler para decidir se mexe em alguma coisa.
   */
  risco: string | null;
  /** O que fazer, quando há risco. */
  solucao: string | null;
};

/**
 * Lê a situação a partir da lista de provedores configurados.
 *
 * A regra de risco é simples e vem do defeito real: UM provedor só não tem
 * para onde cair. Dois já bastam, desde que o segundo não dependa do mesmo
 * limite do primeiro.
 */
export function diagnosticoIA(configurados: ProvedorId[], somenteGratuitos = false): DiagnosticoIA {
  const tem = new Set(configurados);
  let pos = 0;
  const linhas: LinhaProvedor[] = ORDEM_PROVEDORES.map((id) => {
    const configurado = tem.has(id);
    // Pago com a trava ligada: configurado, porém fora da fila.
    const bloqueado = configurado && somenteGratuitos && !GRATUITO[id];
    const naFila = configurado && !bloqueado;
    if (naFila) pos += 1;
    return {
      id,
      nome: NOME_PROVEDOR[id],
      chave: CHAVE_PROVEDOR[id],
      configurado,
      gratuito: GRATUITO[id],
      posicao: naFila ? pos : null,
      bloqueado,
    };
  });

  // O diagnóstico é sobre a fila EFETIVA: de nada adianta contar cinco
  // provedores se três estão barrados pela trava e só dois atendem.
  const ativos = linhas.filter((l) => l.configurado && !l.bloqueado);
  const quantos = ativos.length;

  if (quantos === 0) {
    return {
      linhas, quantos,
      resumo: "Nenhum provedor de IA configurado.",
      risco: "O Orientador não consegue analisar conversa nenhuma.",
      solucao: `Configure ${CHAVE_PROVEDOR.gemini} na Vercel — a API do Gemini tem camada gratuita.`,
    };
  }

  if (quantos === 1) {
    const unico = ativos[0];
    const reserva = ORDEM_PROVEDORES.find((id) => !tem.has(id) && GRATUITO[id]);
    // O Groq sozinho merece aviso próprio: o teto por minuto da camada
    // gratuita é tão baixo (6 mil tokens) que a análise do Orientador precisa
    // ser encolhida para caber — ela lê um trecho da conversa, não a conversa
    // inteira. Funciona, mas é uma limitação real, e o vendedor tem de saber
    // que não é a IA "ficando burra" sem motivo.
    const apertado = unico.id === "groq";
    return {
      linhas, quantos,
      resumo: `Só ${unico.nome}. Sem reserva.`,
      risco: apertado
        ? `O limite por minuto do ${unico.nome} gratuito é baixo, então o Orientador analisa só um trecho da conversa — e para de vez quando o limite estoura, sem ter para onde cair.`
        : `Quando o ${unico.nome} atinge o limite, o Orientador para até a cota voltar — não há para onde cair.`,
      solucao: reserva
        ? `Configure ${CHAVE_PROVEDOR[reserva]} na Vercel (a API do ${NOME_PROVEDOR[reserva]} tem camada gratuita e limite muito maior). O CRM passa a usá-la sozinho, volta a ler a conversa inteira e deixa o ${unico.nome} de reserva.`
        : `Configure um segundo provedor na Vercel para o CRM ter para onde cair.`,
    };
  }

  return {
    linhas, quantos,
    resumo: `${quantos} provedores: ${ativos.map((l) => l.nome).join(" → ")}.`,
    risco: null,
    solucao: null,
  };
}
