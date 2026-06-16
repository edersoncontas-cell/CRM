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

export type { ExtracaoConversa };
