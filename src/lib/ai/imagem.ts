// Geração de IMAGEM com o Gemini: a arte que vai junto da mensagem de
// promoção ou de data comemorativa. Só o Gemini entra aqui (é o único dos
// provedores configurados com geração de imagem na camada gratuita).

import { GEMINI_API_BASE, GEMINI_IMAGE_MODELS } from "./config";
import { marcarEsgotado, modelosDisponiveis, primeiraLiberacao, proximaViradaDiariaGoogle, quandoVolta } from "./imagem-cota";

export type ImagemGerada = { base64: string; mimeType: string; modelo: string };
export type Referencia = { base64: string; mimeType: string };

export function geracaoDeImagemHabilitada(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

type Parte = { text?: string; inlineData?: { mimeType: string; data: string } };

/**
 * A Google diz, dentro do corpo do 429, QUAL cota estourou: quando a chave
 * está no plano gratuito, o quotaMetric/quotaId vem com "free_tier"/"FreeTier"
 * ("generate_content_free_tier_requests",
 * "GenerateRequestsPerDayPerProjectPerModel-FreeTier"). Isso separa as duas
 * situações que pareciam iguais na tela: cota paga apertada (espere e repita)
 * e chave no plano gratuito (nenhuma espera resolve).
 */
export function noPlanoGratuito(detalhe: string): boolean {
  return /free[_-]?tier/i.test(detalhe);
}

/** Segundos de espera que a própria Google sugere ("retryDelay":"37s"). */
export function esperaSugerida(detalhe: string): number | null {
  const m = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/i.exec(detalhe);
  return m ? Number(m[1]) : null;
}

/** Erro da Google traduzido para o que o vendedor precisa saber e fazer. */
export function mensagemDoErro(status: number, detalhe: string): string {
  const d = detalhe.toLowerCase();
  if (status === 429) {
    // Chave no plano gratuito: esperar não adianta. Vale dizer isso na cara,
    // porque assinar o app do Gemini (Google One / Gemini Advanced) NÃO
    // libera cota da API — são produtos separados. O que libera é ativar o
    // faturamento no projeto do Google AI Studio de onde saiu a chave.
    if (noPlanoGratuito(detalhe)) {
      // Sem mandar assinar nada: a arte É de graça, o que acabou foi a cota do
      // dia. A ressalva sobre o app existe porque quem assina o Gemini no
      // celular acha, com razão, que já pagou pela API — e não pagou: são
      // produtos separados, e o app não muda esta cota.
      const volta = quandoVolta(proximaViradaDiariaGoogle());
      return `A cota gratuita de imagens do Gemini acabou por hoje. A criação de arte volta sozinha ${volta}, e o texto do post continua funcionando normalmente. (Assinar o aplicativo Gemini, Google One ou AI Pro não aumenta esta cota — a API é cobrada à parte; só ativar faturamento no projeto do Google AI Studio tiraria o limite.)`;
    }
    const espera = esperaSugerida(detalhe);
    if (espera) {
      return `O Gemini pediu para esperar ${espera}s antes do próximo pedido (limite por minuto). Tente de novo daqui a pouco — a cota do dia não acabou.`;
    }
    return d.includes("per day") || d.includes("daily")
      ? "A cota de imagens do Gemini acabou por hoje. A criação de arte volta sozinha amanhã — o texto do post continua funcionando normalmente."
      : "O Gemini recusou por excesso de pedidos agora. Espere um minuto e tente de novo; se insistir, a cota do dia acabou e volta amanhã.";
  }
  if (status === 401 || status === 403) {
    return "A chave do Gemini (GEMINI_API_KEY) foi recusada. Confira a chave nas variáveis da Vercel.";
  }
  if (status === 400 && (d.includes("safety") || d.includes("blocked"))) {
    return "O Gemini achou que o pedido esbarra nas regras dele. Descreva a arte de outro jeito.";
  }
  if (status >= 500) {
    return "O serviço do Gemini está instável agora. Tente de novo em alguns minutos.";
  }
  return `Não consegui criar a arte (erro ${status} do Gemini). Tente de novo; se continuar, mude a descrição.`;
}

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
    // Mensagem em português, não o JSON cru da Google: quem lê é o vendedor,
    // e "You exceeded your current quota" no meio de um JSON não diz o que
    // fazer. O detalhe técnico fica no log do servidor.
    const erro = new Error(mensagemDoErro(res.status, detalhe)) as Error & { status?: number; detalhe?: string };
    erro.status = res.status;
    // O corpo cru vai junto: é nele que a Google diz se foi o teto do dia ou
    // o do minuto, e é isso que decide até quando marcar o modelo como fora.
    erro.detalhe = detalhe;
    console.error(`[gemini-imagem] ${modelo} ${res.status}: ${detalhe.slice(0, 300)}`);
    throw erro;
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: Parte[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
  if (data.promptFeedback?.blockReason) throw new Error(`O Gemini recusou o pedido (${data.promptFeedback.blockReason}). Tente descrever a arte de outro jeito.`);
  const parte = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!parte?.inlineData) throw new Error("O Gemini respondeu sem imagem. Tente de novo ou mude a descrição.");
  return { base64: parte.inlineData.data, mimeType: parte.inlineData.mimeType || "image/png", modelo };
}

// Tenta os modelos na ordem de GEMINI_IMAGE_MODELS: modelo que não existe
// mais (404), que não aceita imagem (400) ou que estourou a cota (429) passa
// a vez — a cota do Gemini é por modelo, então o seguinte da lista pode estar
// livre. Outros erros param a fila.
export async function gerarImagemGemini(prompt: string, referencias: Referencia[] = []): Promise<ImagemGerada> {
  if (!geracaoDeImagemHabilitada()) throw new Error("Geração de imagem exige GEMINI_API_KEY.");

  // A arte roda na camada GRATUITA do Gemini, que tem teto por minuto e por
  // dia — e cada modelo tem o SEU teto. Modelo que já avisou que acabou não é
  // tentado de novo: antes, cada clique queimava uma chamada em cada modelo
  // sem chance nenhuma de dar certo, e a tela só sabia dizer "espere um
  // minuto".
  const agora = new Date();
  const disponiveis = modelosDisponiveis(GEMINI_IMAGE_MODELS, agora);
  if (!disponiveis.length) {
    const volta = primeiraLiberacao(GEMINI_IMAGE_MODELS, agora);
    throw new Error(
      `A cota gratuita de imagens do Gemini acabou. A criação de arte volta sozinha ${volta ? quandoVolta(volta, agora) : "em breve"} — o texto do post continua funcionando normalmente.`,
    );
  }

  let ultimo: unknown = null;
  for (const modelo of disponiveis) {
    try {
      return await gerarComModelo(modelo, prompt, referencias);
    } catch (e) {
      ultimo = e;
      const status = (e as { status?: number }).status;
      const detalhe = (e as { detalhe?: string }).detalhe ?? "";
      if (status === 429) {
        // Teto do dia: só volta na virada do Google (meia-noite do Pacífico).
        // Teto do minuto: volta na espera que a própria Google pediu.
        const espera = esperaSugerida(detalhe);
        const porDia = noPlanoGratuito(detalhe) || /per day|daily/i.test(detalhe) || !espera;
        marcarEsgotado(modelo, porDia ? proximaViradaDiariaGoogle(agora) : new Date(agora.getTime() + espera * 1000));
      }
      console.error(`[gemini-imagem] ${modelo} falhou:`, e instanceof Error ? e.message : e);
      if (status !== 404 && status !== 400 && status !== 429) break;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}
