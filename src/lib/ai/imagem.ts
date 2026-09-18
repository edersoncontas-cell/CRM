// Geração de IMAGEM com o Gemini: a arte que vai junto da mensagem de
// promoção ou de data comemorativa. Só o Gemini entra aqui (é o único dos
// provedores configurados com geração de imagem na camada gratuita).

import { GEMINI_API_BASE, GEMINI_IMAGE_MODELS } from "./config";

export type ImagemGerada = { base64: string; mimeType: string; modelo: string };
export type Referencia = { base64: string; mimeType: string };

export function geracaoDeImagemHabilitada(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

type Parte = { text?: string; inlineData?: { mimeType: string; data: string } };

async function gerarComModelo(modelo: string, prompt: string, referencias: Referencia[]): Promise<ImagemGerada> {
  const res = await fetch(`${GEMINI_API_BASE}/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          ...referencias.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.base64 } })),
          { text: prompt },
        ],
      }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    const erro = new Error(`Gemini ${modelo} (${res.status}): ${detalhe.slice(0, 200)}`) as Error & { status?: number };
    erro.status = res.status;
    throw erro;
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: Parte[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
  if (data.promptFeedback?.blockReason) throw new Error(`O Gemini recusou o pedido (${data.promptFeedback.blockReason}). Tente descrever a arte de outro jeito.`);
  const parte = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!parte?.inlineData) throw new Error("O Gemini respondeu sem imagem. Tente de novo ou mude a descrição.");
  return { base64: parte.inlineData.data, mimeType: parte.inlineData.mimeType || "image/png", modelo };
}

// Tenta os modelos na ordem de GEMINI_IMAGE_MODELS: modelo que não existe
// mais (404) ou não aceita imagem (400) passa a vez; outros erros param.
export async function gerarImagemGemini(prompt: string, referencias: Referencia[] = []): Promise<ImagemGerada> {
  if (!geracaoDeImagemHabilitada()) throw new Error("Geração de imagem exige GEMINI_API_KEY.");
  let ultimo: unknown = null;
  for (const modelo of GEMINI_IMAGE_MODELS) {
    try {
      return await gerarComModelo(modelo, prompt, referencias);
    } catch (e) {
      ultimo = e;
      const status = (e as { status?: number }).status;
      console.error(`[gemini-imagem] ${modelo} falhou:`, e instanceof Error ? e.message : e);
      if (status !== 404 && status !== 400) break;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}
