// Loop agêntico do Cérebro para provedores no FORMATO OpenAI — Gemini (pelo
// endpoint de compatibilidade do Google), Groq, DeepSeek e a própria OpenAI.
// Existe para o chat do Cérebro (com ferramentas) funcionar sem a Anthropic,
// que é o provedor mais caro. O HISTÓRICO continua salvo no formato de blocos
// da Anthropic (como sempre foi no banco) — a conversão acontece só na hora
// de chamar, então dá pra alternar de provedor no meio de uma sessão sem
// perder nada.

import OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import { OPENAI_MODEL, GEMINI_MODELOS_CHAT, GEMINI_API_BASE, DEEPSEEK_MODEL } from "./config";
import { decidirPeloErro, modeloGeminiDaVez } from "./gemini-modelos";
import { marcarEsgotado } from "./imagem-cota";
import { modeloGroq, erroDeModeloGroq, marcarModeloGroqRuim, parametrosGroq, GROQ_BASE_URL } from "./groq";

type ProvedorCompat = { nome: string; client: OpenAI; model: string; visao: boolean };

// Mesma ordem de preferência de llmTexto (do mais barato pro mais caro).
export function provedoresCompat(): ProvedorCompat[] {
  const lista: ProvedorCompat[] = [];
  if (process.env.GEMINI_API_KEY) {
    // O modelo sai da lista do CHAT (Flash primeiro); o que sumiu ou esgotou a
    // cota fica de fora (ver gemini-modelos.ts). O endereço vem do
    // GEMINI_API_BASE, como nas outras chamadas — antes era fixo aqui, e o
    // servidor falso dos testes não alcançava o chat.
    const modelo = modeloGeminiDaVez(GEMINI_MODELOS_CHAT);
    if (modelo) {
      lista.push({
        nome: "gemini",
        client: new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: `${GEMINI_API_BASE}/v1beta/openai/` }),
        model: modelo,
        visao: true,
      });
    }
  }
  if (process.env.GROQ_API_KEY) {
    lista.push({
      nome: "groq",
      client: new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: GROQ_BASE_URL }),
      model: "", // escolhido na hora da chamada (ver ./groq.ts)
      visao: false,
    });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    lista.push({
      nome: "deepseek",
      client: new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" }),
      model: DEEPSEEK_MODEL,
      visao: false,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    lista.push({ nome: "openai", client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model: OPENAI_MODEL, visao: true });
  }
  return lista;
}

type Bloco = Record<string, unknown>;
const blocosDe = (content: Anthropic.MessageParam["content"]): Bloco[] =>
  typeof content === "string" ? [{ type: "text", text: content }] : (content as unknown as Bloco[]);
const texto = (b: Bloco): string => (typeof b.text === "string" ? b.text : "");

// Definição de tool da Anthropic -> tool "function" da OpenAI (mesmo JSON Schema).
export function toolsParaOpenAI(defs: Anthropic.Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return defs.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema as unknown as Record<string, unknown> },
  }));
}

// Histórico em blocos da Anthropic -> mensagens no formato OpenAI.
export function historicoParaOpenAI(
  system: string,
  messages: Anthropic.MessageParam[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: system }];

  for (const m of messages) {
    const blocos = blocosDe(m.content);

    if (m.role === "assistant") {
      const conteudo = blocos.filter((b) => b.type === "text").map(texto).join("\n");
      const toolCalls = blocos
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          id: String(b.id),
          type: "function" as const,
          function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) },
        }));
      out.push({ role: "assistant", content: conteudo, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
      continue;
    }

    // user: resultados de ferramenta viram mensagens "tool"; texto/imagem viram "user".
    for (const b of blocos) {
      if (b.type !== "tool_result") continue;
      out.push({
        role: "tool",
        tool_call_id: String(b.tool_use_id),
        content: typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? ""),
      });
    }
    const partes: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    for (const b of blocos) {
      if (b.type === "text") partes.push({ type: "text", text: texto(b) });
      else if (b.type === "image") {
        const source = b.source as { type?: string; media_type?: string; data?: string } | undefined;
        if (source?.type === "base64" && source.data) {
          partes.push({ type: "image_url", image_url: { url: `data:${source.media_type ?? "image/jpeg"};base64,${source.data}` } });
        }
      }
    }
    if (partes.length) {
      const soTexto = partes.every((p) => p.type === "text");
      out.push({ role: "user", content: soTexto ? partes.map((p) => (p.type === "text" ? p.text : "")).join("\n") : partes });
    }
  }
  return out;
}

export type RodadaCompat = {
  provedor: string;
  texto: string;
  toolCalls: { id: string; name: string; input: Record<string, unknown> }[];
};

// Uma rodada do agente (sem streaming). Tenta cada provedor na ordem; se um
// falhar (limite do plano grátis, sem crédito), passa pro próximo.
export async function rodadaAgenteCompat(
  system: string,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  precisaVisao: boolean
): Promise<RodadaCompat> {
  const provs = provedoresCompat().filter((p) => !precisaVisao || p.visao);
  if (!provs.length) {
    throw new Error(precisaVisao
      ? "Nenhum provedor com leitura de imagem configurado (GEMINI_API_KEY ou OPENAI_API_KEY)."
      : "Nenhum provedor de IA configurado (GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY ou OPENAI_API_KEY).");
  }

  const msgs = historicoParaOpenAI(system, messages);
  const ferramentas = toolsParaOpenAI(tools);

  let ultimoErro: unknown = null;
  for (const p of provs) {
    try {
      // Groq: modelo escolhido automaticamente; se ele foi desativado, troca e refaz uma vez.
      let modelo = p.nome === "groq" ? await modeloGroq() : p.model;
      let resp;
      for (let tentativa = 0; ; tentativa++) {
        try {
          // Groq com modelo de raciocínio: limite maior (o "pensamento" conta no limite).
          const extras = p.nome === "groq" ? parametrosGroq(modelo, 2048, false) : { model: modelo, max_tokens: 2048 };
          resp = await p.client.chat.completions.create({
            ...(extras as { model: string; max_tokens: number }),
            messages: msgs,
            tools: ferramentas,
            tool_choice: "auto",
          });
          break;
        } catch (e) {
          if (p.nome === "groq" && tentativa === 0 && erroDeModeloGroq(e)) { marcarModeloGroqRuim(modelo); modelo = await modeloGroq(); continue; }
          // Gemini: modelo que sumiu (404) ou esgotou a cota (429) passa a vez
          // ao próximo da lista do chat, como no resto do CRM.
          if (p.nome === "gemini" && tentativa < GEMINI_MODELOS_CHAT.length) {
            const status = (e as { status?: number }).status ?? 0;
            const decisao = decidirPeloErro(status, e instanceof Error ? e.message : String(e));
            if (decisao.acao === "proximo-modelo") {
              marcarEsgotado(modelo, decisao.ate);
              const proximo = modeloGeminiDaVez(GEMINI_MODELOS_CHAT);
              if (proximo) { modelo = proximo; continue; }
            }
          }
          throw e;
        }
      }
      const escolha = resp.choices[0]?.message;
      const toolCalls: RodadaCompat["toolCalls"] = [];
      for (const tc of escolha?.tool_calls ?? []) {
        if (tc.type !== "function") continue;
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(tc.function.arguments || "{}"); } catch { input = {}; }
        toolCalls.push({ id: tc.id, name: tc.function.name, input });
      }
      return { provedor: p.nome, texto: (escolha?.content ?? "").trim(), toolCalls };
    } catch (e) {
      ultimoErro = e;
      console.error(`[cerebro-compat] provedor ${p.nome} falhou, tentando o próximo:`, e instanceof Error ? e.message : e);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}
