// Criação de arte pela OpenAI — a reserva de quando a cota gratuita do Gemini
// acaba (ver imagem.ts, que orquestra os dois).
//
// ATENÇÃO AO CUSTO, porque aqui não existe camada gratuita: a API da OpenAI é
// pré-paga e cada imagem é cobrada. Assinar o ChatGPT Plus NÃO dá acesso à API
// — é a mesma armadilha do Google One com o Gemini, produtos separados.
//
// Por isso o Gemini é sempre tentado primeiro e esta reserva só entra quando a
// cota grátis do dia acabou: no uso normal, a conta fica em zero.
//
// Ordem de grandeza do gpt-image-1 em 1024x1024 (consulte o preço atual da
// OpenAI, isto aqui é só para dimensionar): qualidade baixa ~1 centavo de
// dólar por imagem, média ~4 centavos, alta ~17 centavos. O padrão aqui é
// média; dá para mudar em IMAGEM_OPENAI_QUALIDADE.

import type { ImagemGerada, Referencia } from "./imagem-tipos";

const MODELO = process.env.IMAGEM_OPENAI_MODELO || "gpt-image-1";
const QUALIDADE = process.env.IMAGEM_OPENAI_QUALIDADE || "medium";
const TAMANHO = process.env.IMAGEM_OPENAI_TAMANHO || "1024x1024";
const BASE = (process.env.OPENAI_API_BASE || "https://api.openai.com").replace(/\/+$/, "");

export function openaiImagemHabilitada(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Erro da OpenAI em português, dizendo o que fazer. */
export function mensagemErroOpenAI(status: number, detalhe: string): string {
  const d = detalhe.toLowerCase();
  if (status === 401) {
    return "A chave da OpenAI (OPENAI_API_KEY) foi recusada. Confira nas variáveis da Vercel.";
  }
  if (status === 429 || d.includes("insufficient_quota") || d.includes("billing")) {
    // O caso mais provável: chave criada, mas sem crédito comprado. A API da
    // OpenAI é pré-paga e o ChatGPT Plus não conta.
    return "A OpenAI recusou por falta de crédito ou excesso de pedidos. A API da OpenAI é pré-paga e é cobrada à parte do ChatGPT Plus — confira o saldo em platform.openai.com/billing.";
  }
  if (status === 400 && (d.includes("safety") || d.includes("moderation") || d.includes("content_policy"))) {
    return "A OpenAI achou que o pedido esbarra nas regras dela. Descreva a arte de outro jeito.";
  }
  if (status >= 500) return "O serviço da OpenAI está instável agora. Tente de novo em alguns minutos.";
  return `Não consegui criar a arte (erro ${status} da OpenAI). Tente de novo; se continuar, mude a descrição.`;
}

function erroDe(status: number, detalhe: string): Error & { status?: number; detalhe?: string } {
  const e = new Error(mensagemErroOpenAI(status, detalhe)) as Error & { status?: number; detalhe?: string };
  e.status = status;
  e.detalhe = detalhe;
  console.error(`[openai-imagem] ${status}: ${detalhe.slice(0, 300)}`);
  return e;
}

function lerResposta(json: unknown): ImagemGerada {
  const data = (json as { data?: { b64_json?: string }[] }).data;
  const b64 = data?.[0]?.b64_json;
  if (!b64) throw new Error("A OpenAI respondeu sem imagem. Tente de novo ou mude a descrição.");
  return { base64: b64, mimeType: "image/png", modelo: `openai:${MODELO}` };
}

/**
 * Gera a arte.
 *
 * Com imagem de referência vai por /images/edits (multipart, aceita mais de
 * uma foto); sem referência, por /images/generations. São endpoints
 * diferentes de propósito — mandar referência no de geração simplesmente a
 * ignora, e o vendedor anexaria a foto da máquina para nada.
 */
export async function gerarImagemOpenAI(prompt: string, referencias: Referencia[] = []): Promise<ImagemGerada> {
  if (!openaiImagemHabilitada()) throw new Error("Criar arte pela OpenAI exige OPENAI_API_KEY.");
  const auth = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };

  if (referencias.length) {
    const form = new FormData();
    form.append("model", MODELO);
    form.append("prompt", prompt);
    form.append("size", TAMANHO);
    form.append("quality", QUALIDADE);
    form.append("n", "1");
    referencias.forEach((r, i) => {
      const bin = Buffer.from(r.base64, "base64");
      form.append("image[]", new Blob([bin], { type: r.mimeType || "image/png" }), `ref${i}.png`);
    });
    const res = await fetch(`${BASE}/v1/images/edits`, {
      method: "POST", headers: auth, body: form, signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw erroDe(res.status, await res.text().catch(() => ""));
    return lerResposta(await res.json());
  }

  const res = await fetch(`${BASE}/v1/images/generations`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO, prompt, size: TAMANHO, quality: QUALIDADE, n: 1 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw erroDe(res.status, await res.text().catch(() => ""));
  return lerResposta(await res.json());
}
