import Anthropic from "@anthropic-ai/sdk";
import { extrairHeuristica, type ExtracaoConversa } from "./heuristics";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function iaHabilitada() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SCHEMA_INSTRUCAO = `Você é o cérebro de um CRM de um vendedor de máquinas pesadas New Holland
no sul do Espírito Santo. Analise a conversa com um cliente e devolva SOMENTE um JSON válido,
sem texto antes ou depois, com as chaves:
{
  "resumo": string,                       // 1-2 frases do que aconteceu
  "perfil": string,                       // perfil do cliente (produtor, construtora, etc.)
  "maquina": string|null,                 // modelo negociado (ex: "T7", "TL5")
  "valor": number|null,                   // valor em reais (número puro)
  "condicaoPagamento": "avista"|"consorcio"|"financiamento"|"outro"|null,
  "concorrente": string|null,             // concorrente citado (John Deere, Valtra...)
  "dataVisita": string|null,              // ISO 8601 se houver agendamento de visita
  "sentimento": "positivo"|"neutro"|"negativo",
  "ehProspectReal": boolean,              // realmente negociou/pediu info de máquina?
  "rascunhoResposta": string              // resposta sugerida no tom do vendedor
}`;

export async function analisarConversaIA(
  texto: string,
  opts?: { estiloDeFala?: string | null; base?: Date }
): Promise<ExtracaoConversa> {
  if (!iaHabilitada()) {
    return extrairHeuristica(texto, opts?.base);
  }

  try {
    const tom = opts?.estiloDeFala
      ? `\n\nEstilo de fala do vendedor (imite no rascunhoResposta):\n${opts.estiloDeFala}`
      : "";
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SCHEMA_INSTRUCAO + tom,
      messages: [{ role: "user", content: `Conversa:\n${texto}` }],
    });
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return {
      resumo: parsed.resumo ?? "",
      perfil: parsed.perfil ?? null,
      maquina: parsed.maquina ?? null,
      valor: typeof parsed.valor === "number" ? parsed.valor : null,
      condicaoPagamento: parsed.condicaoPagamento ?? null,
      concorrente: parsed.concorrente ?? null,
      dataVisita: parsed.dataVisita ? new Date(parsed.dataVisita) : null,
      sentimento: parsed.sentimento ?? "neutro",
      ehProspectReal: !!parsed.ehProspectReal,
      rascunhoResposta: parsed.rascunhoResposta ?? "",
      fonte: "ia",
    };
  } catch (err) {
    console.error("Falha na IA, usando heurística:", err);
    return extrairHeuristica(texto, opts?.base);
  }
}

// Aprende o tom do vendedor a partir de mensagens dele (com fallback simples).
export async function aprenderTomIA(mensagensVendedor: string[]): Promise<string> {
  const amostra = mensagensVendedor.slice(0, 30).join("\n---\n");
  if (!iaHabilitada() || !amostra.trim()) {
    return "Tom cordial, direto e regional (sul do ES). Usa saudações calorosas, trata o cliente por 'você/senhor', foca em benefícios práticos da máquina e em fechar a visita.";
  }
  try {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 512,
      system:
        "Analise as mensagens de um vendedor e descreva em 3-5 linhas o tom/estilo dele (saudações, gírias, formalidade, emojis) para que outra IA imite. Responda só com a descrição.",
      messages: [{ role: "user", content: amostra }],
    });
    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch {
    return "Tom cordial, direto e regional. Foca em benefícios da máquina e em marcar a visita.";
  }
}

// Gera um post de mídia chamativo sobre uma máquina (curiosidade/atração).
export async function gerarMidiaIA(maquina: {
  modelo: string;
  categoria: string;
  descricao?: string | null;
  curiosidades?: string | null;
}): Promise<{ titulo: string; conteudo: string }> {
  if (!iaHabilitada()) {
    return {
      titulo: `Você conhece a ${maquina.modelo}?`,
      conteudo: `🚜 A New Holland ${maquina.modelo} (${maquina.categoria}) é potência e economia no mesmo lugar! ${
        maquina.curiosidades || maquina.descricao || "Tecnologia de ponta para o seu negócio crescer."
      }\n\nQuer saber as condições? Me chama aqui! 👇`,
    };
  }
  try {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 600,
      system:
        "Você é social media de um vendedor New Holland. Crie um post curto, chamativo e com emojis para WhatsApp/Instagram sobre a máquina. Devolva JSON: {\"titulo\": string, \"conteudo\": string}.",
      messages: [
        {
          role: "user",
          content: `Máquina: ${maquina.modelo} (${maquina.categoria}). ${maquina.descricao ?? ""} Curiosidades: ${maquina.curiosidades ?? ""}`,
        },
      ],
    });
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return { titulo: parsed.titulo, conteudo: parsed.conteudo };
  } catch {
    return {
      titulo: `Conheça a ${maquina.modelo}`,
      conteudo: `🚜 New Holland ${maquina.modelo}: ${maquina.descricao ?? "performance e economia para o seu dia a dia."}`,
    };
  }
}

// ────────────────────────────────────────────────────────────
// Marketing post generation
// ────────────────────────────────────────────────────────────

export type TipoPost =
  | "diario"
  | "segunda"
  | "sexta"
  | "mensal_inicio"
  | "mensal_fim"
  | "avulso";

export interface PostMarketing {
  titulo: string;
  corpo: string;
  hashtags: string;
}

const TEMA_POR_TIPO: Record<TipoPost, string> = {
  diario: "dica técnica rápida, curiosidade ou vantagem específica de uma máquina",
  segunda: "motivação para a semana + oportunidade comercial (Finame/BNDES/consórcio)",
  sexta: "resultado da semana + call-to-action forte para fechar antes do final de semana",
  mensal_inicio: "abertura do mês: novidades, promoções, convite para visita técnica",
  mensal_fim: "últimos dias do mês, urgência comercial, condições que vencem",
  avulso: "post chamativo e criativo sobre a máquina ou linha de equipamentos",
};

export async function gerarPostMarketingIA(
  maquina: {
    modelo: string;
    marca: string;
    categoria: string;
    descricao?: string | null;
    pontosFortes?: string | null;
    curiosidades?: string | null;
  } | null,
  tipo: TipoPost,
  feedbackAnterior?: string,
  conteudoAnterior?: string
): Promise<PostMarketing> {
  if (!iaHabilitada()) {
    return _postHeuristico(maquina, tipo);
  }

  const tema = TEMA_POR_TIPO[tipo] ?? TEMA_POR_TIPO.avulso;
  const infoMaquina = maquina
    ? `Máquina: ${maquina.marca} ${maquina.modelo} (${maquina.categoria}). ${maquina.descricao ?? ""} Pontos fortes: ${maquina.pontosFortes ?? ""} Curiosidades: ${maquina.curiosidades ?? ""}`
    : "Linha completa de máquinas pesadas";

  const feedbackPart =
    feedbackAnterior && conteudoAnterior
      ? `\n\nPost anterior gerado (reescreva melhorando com base no feedback):\n---\n${conteudoAnterior}\n---\nFeedback do vendedor: "${feedbackAnterior}"`
      : "";

  try {
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 800,
      system: `Você é o social media de Ederson, vendedor de máquinas pesadas New Holland Construction e Dynapac no sul do Espírito Santo (Brasil).
Crie posts CRIATIVOS, com emojis estratégicos, linguagem profissional mas próxima.
Tema do post: ${tema}.
REGRA IMPORTANTE: NUNCA misture New Holland com Dynapac no mesmo post.
Seja específico, mencione o modelo da máquina. Use dados reais de produtividade/economia quando disponíveis.
Devolva SOMENTE um JSON válido (sem texto fora do JSON):
{"titulo": string, "corpo": string, "hashtags": string}
"corpo": texto completo do post com emojis, máx 450 caracteres para WhatsApp.
"hashtags": string com hashtags separadas por espaço.`,
      messages: [{ role: "user", content: `${infoMaquina}${feedbackPart}` }],
    });
    const raw = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      titulo: parsed.titulo ?? "Post de marketing",
      corpo: parsed.corpo ?? "",
      hashtags: parsed.hashtags ?? "",
    };
  } catch {
    return _postHeuristico(maquina, tipo);
  }
}

function _postHeuristico(
  maquina: { modelo: string; marca: string; categoria: string; curiosidades?: string | null } | null,
  tipo: TipoPost
): PostMarketing {
  const modelo = maquina?.modelo ?? "E245C";
  const marca = maquina?.marca ?? "New Holland";
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const curiosidade =
    maquina?.curiosidades ?? "eficiência de combustível superior e conforto operador de alto nível";

  const templates: Record<TipoPost, PostMarketing> = {
    diario: {
      titulo: `💡 Sabia disso sobre a ${marca} ${modelo}?`,
      corpo: `🔧 Dica do dia!\n\n${marca} ${modelo}: ${curiosidade}.\n\nIsso significa MAIS OBRA com MENOS custo. 💪\n\nQuer um comparativo técnico? Me chama! 👇`,
      hashtags: `#${marca.replace(/ /g, "")} #${modelo} #MaquinaPesada #Construção #SulES`,
    },
    segunda: {
      titulo: `🚀 Segunda de conquistas — bora fechar!`,
      corpo: `Bom dia! 🌅 Semana nova, oportunidade nova!\n\nA ${marca} ${modelo} está disponível com condições especiais Finame/BNDES. Parcelas que cabem no seu fluxo de caixa!\n\n✅ Taxa reduzida\n✅ Demonstração gratuita\n✅ Proposta em 24h\n\nMe chama! 👇`,
      hashtags: `#SegundaFeira #${marca.replace(/ /g, "")} #Finame #MaquinaPesada #Construção`,
    },
    sexta: {
      titulo: `🎯 Sexta-feira: última chance da semana!`,
      corpo: `🎉 Chegou a sexta!\n\nSe você ficou pensando na ${marca} ${modelo} essa semana… hoje é o dia de decidir! Condições especiais para quem fechar até amanhã.\n\nLiga agora e garanta! 📱`,
      hashtags: `#SextaFeira #FecharNegócio #${marca.replace(/ /g, "")} #${modelo} #Oportunidade`,
    },
    mensal_inicio: {
      titulo: `📅 Começo de ${mes} com novidades!`,
      corpo: `Novo mês, novas oportunidades! 🎯\n\nEm ${mes} estamos com:\n✅ Finame/BNDES — taxas especiais\n✅ Demonstração técnica GRATUITA\n✅ Proposta personalizada em 24h\n\nA ${marca} ${modelo} pode ser sua este mês! 📞`,
      hashtags: `#${mes} #${marca.replace(/ /g, "")} #Finame #Promoção #MaquinaPesada`,
    },
    mensal_fim: {
      titulo: `⏰ Últimos dias de ${mes} — não perca!`,
      corpo: `⚠️ ATENÇÃO!\n\nEstamos nos ÚLTIMOS DIAS de ${mes}!\n\nAs condições especiais da ${marca} ${modelo} ENCERRAM em breve:\n🔥 Financiamento facilitado\n🔥 Entrada menor\n🔥 Demonstração na sua obra\n\nMe chama AGORA! ⬇️`,
      hashtags: `#ÚltimosDias #${marca.replace(/ /g, "")} #OfertaEspecial #Urgente #MaquinaPesada`,
    },
    avulso: {
      titulo: `🚜 ${marca} ${modelo} — Potência na sua obra!`,
      corpo: `Conheça a ${marca} ${modelo}! 💪\n\n${curiosidade}.\n\nIdeal para construtoras e empreiteiras que buscam mais produtividade e economia.\n\nSolicite sua proposta hoje! 📲`,
      hashtags: `#${marca.replace(/ /g, "")} #${modelo} #MaquinaPesada #Construção #SulES`,
    },
  };

  return templates[tipo] ?? templates.avulso;
}

export type { ExtracaoConversa };
