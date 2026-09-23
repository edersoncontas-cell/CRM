// A TRAVA GERAL: nenhuma mensagem sai.
//
// Escrita depois do SEGUNDO bloqueio do número do vendedor. Ele cancelou os
// envios em massa na tela de Marketing e as mensagens continuaram saindo o dia
// inteiro — porque o cancelamento só valia para envio em "pendente", e o envio
// em ondas fica em "enviando" entre uma rodada e outra. Cancelar não cancelava.
//
// Esta trava não depende de nenhuma dessas regras. Ela fica no nível mais
// baixo, na porta de saída: campanha, resposta automática do ZEUS, parabéns de
// aniversário, mensagem digitada na tela — nada passa.
//
// PADRÃO: PAUSADO. A ausência de configuração nunca pode significar "pode
// mandar": foi confiando em regra mais acima que o número caiu duas vezes.
// Para voltar a enviar é preciso um ato explícito na tela de Configurações.

import { getConfig, setConfig } from "@/lib/config";

export const CHAVE_PAUSA = "whatsapp.pausa.v1";

/** Erro de envio bloqueado. Não é falha de rede: é a trava funcionando. */
export class EnvioPausadoError extends Error {
  constructor() {
    super("Envio de WhatsApp está PAUSADO no CRM (Configurações → Envio de mensagens).");
    this.name = "EnvioPausadoError";
  }
}

// Cache curto: uma rodada de envio chama isto uma vez por mensagem, e não faz
// sentido ir ao banco a cada uma. 10s é pouco o bastante para "despausar"
// valer quase na hora, e o suficiente para não pesar.
const CACHE_MS = 10_000;
let cache: { pausado: boolean; em: number } | null = null;

export function limparCachePausa(): void {
  cache = null;
}

export async function envioPausado(): Promise<boolean> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.pausado;
  let pausado = true; // o padrão, inclusive quando o banco não responde
  try {
    const v = await getConfig(CHAVE_PAUSA);
    // Só a palavra exata libera. Qualquer outra coisa — nulo, lixo, valor
    // antigo — deixa pausado.
    pausado = v !== "liberado";
  } catch {
    pausado = true;
  }
  cache = { pausado, em: Date.now() };
  return pausado;
}

/** Levanta se estiver pausado. Chamada no topo de toda função de envio. */
export async function exigirEnvioLiberado(): Promise<void> {
  if (await envioPausado()) throw new EnvioPausadoError();
}

export async function definirPausa(pausado: boolean): Promise<void> {
  await setConfig(CHAVE_PAUSA, pausado ? "pausado" : "liberado");
  limparCachePausa();
}
