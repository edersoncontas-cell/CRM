// QUAL MODELO GEMINI USAR — e o que fazer quando ele some ou esgota.
//
// Por que existe: o CRM chamava UM modelo fixo, "gemini-2.5-flash", e o Google
// anunciou o desligamento dele para outubro de 2026 (16/10 na página do Gemini
// API, 20/10 no Google Cloud — levantamento de 24/09/2026). Com um nome só, o
// dia do desligamento seria o dia em que o Orientador, os resumos e o chat
// param de responder. A arte de marketing já tinha resolvido isso com uma
// LISTA (config.ts, GEMINI_IMAGE_MODELS): modelo que some, o próximo assume.
// Aqui o texto passa a fazer igual, reaproveitando o mesmo registro de cota
// (imagem-cota.ts) — cada modelo do Gemini tem a SUA cota grátis, então o
// segundo da lista também estende o dia de graça.

import { GEMINI_API_BASE } from "./config";
import { marcarEsgotado, modelosDisponiveis, primeiraLiberacao, proximaViradaDiariaGoogle, quandoVolta } from "./imagem-cota";

/** Segundos de espera que a própria Google sugere ("retryDelay":"37s"). */
function esperaSugerida(detalhe: string): number | null {
  const m = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/i.exec(detalhe);
  return m ? Number(m[1]) : null;
}

export type Decisao =
  | { acao: "proximo-modelo"; ate: Date }   // este modelo não serve agora; tenta o seguinte
  | { acao: "sem-raciocinio" }              // o modelo não aceita a config de raciocínio; repete sem ela
  | { acao: "falhar" };                     // erro que outro modelo não resolve (chave, pedido, instabilidade)

/**
 * O que fazer com um erro do Gemini. Pura, para os testes cobrirem cada caso.
 *  · 404 / "not found" — o modelo não existe mais (desligado ou nome errado).
 *    Fica fora por 24 h: não adianta bater de novo a cada mensagem.
 *  · 429 — cota. Do DIA: volta na virada do Pacífico. Do MINUTO: volta na
 *    espera que o Google pediu. Nos dois casos o próximo modelo tem a sua.
 *  · 400 que fala de "thinking" — o modelo não aceita a configuração de
 *    raciocínio (ela nasceu no 2.5); repete o mesmo pedido sem ela.
 *  · o resto — falha e deixa a fila de provedores (Groq…) seguir.
 */
export function decidirPeloErro(status: number, detalhe: string, agora: Date = new Date(), comRaciocinio = false): Decisao {
  const d = detalhe.toLowerCase();
  if (status === 404 || (status === 400 && /not found|is not supported for generatecontent|unknown model/.test(d))) {
    return { acao: "proximo-modelo", ate: new Date(agora.getTime() + 24 * 3600_000) };
  }
  if (status === 429) {
    const espera = esperaSugerida(detalhe);
    const porDia = /free[_-]?tier|per day|daily/i.test(detalhe) || !espera;
    return { acao: "proximo-modelo", ate: porDia ? proximaViradaDiariaGoogle(agora) : new Date(agora.getTime() + (espera ?? 60) * 1000) };
  }
  if (status === 400 && comRaciocinio && /thinking/.test(d)) return { acao: "sem-raciocinio" };
  return { acao: "falhar" };
}

export class ErroGemini extends Error {
  constructor(msg: string, public status: number, public detalhe: string) { super(msg); }
}

type Corpo = { generationConfig?: Record<string, unknown> } & Record<string, unknown>;

/**
 * Chama o generateContent tentando os modelos da lista na ordem. Devolve o
 * JSON da resposta e o modelo que respondeu. Se nenhum servir, o erro diz
 * quando a cota volta (quando é cota) — nunca um "falhou" seco.
 */
export async function gerarConteudoGemini(
  modelos: string[],
  corpo: Corpo,
  opts?: { timeoutMs?: number },
): Promise<{ data: unknown; modelo: string }> {
  const agora = new Date();
  const fila = modelosDisponiveis(modelos, agora);
  if (!fila.length) {
    const volta = primeiraLiberacao(modelos, agora);
    throw new ErroGemini(`A cota gratuita do Gemini acabou em todos os modelos. Volta sozinha ${volta ? quandoVolta(volta, agora) : "em breve"}.`, 429, "");
  }

  let ultimo: ErroGemini | null = null;
  for (const modelo of fila) {
    let pedido = corpo;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const res = await fetch(`${GEMINI_API_BASE}/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
        ...(opts?.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
      });
      if (res.ok) return { data: await res.json(), modelo };

      const detalhe = await res.text().catch(() => "");
      ultimo = new ErroGemini(`Falha no Gemini ${modelo} (${res.status}): ${detalhe.slice(0, 200)}`, res.status, detalhe);
      const comRaciocinio = !!pedido.generationConfig?.thinkingConfig;
      const decisao = decidirPeloErro(res.status, detalhe, new Date(), comRaciocinio);
      if (decisao.acao === "sem-raciocinio") {
        const { thinkingConfig: _fora, ...resto } = pedido.generationConfig ?? {};
        void _fora;
        pedido = { ...pedido, generationConfig: resto };
        continue; // mesmo modelo, sem raciocínio
      }
      if (decisao.acao === "proximo-modelo") {
        marcarEsgotado(modelo, decisao.ate);
        console.warn(`[gemini] ${modelo} fora (${res.status}) — tentando o próximo da lista.`);
        break; // próximo modelo
      }
      throw ultimo; // erro que outro modelo não resolve
    }
  }
  throw ultimo ?? new ErroGemini("Nenhum modelo do Gemini respondeu.", 0, "");
}

/** O primeiro modelo da lista que não está fora agora — para quem não usa gerarConteudoGemini (o chat). */
export function modeloGeminiDaVez(modelos: string[]): string | null {
  return modelosDisponiveis(modelos)[0] ?? null;
}
