// A TRAVA DE GASTO DE IA — num lugar só.
//
// A escolha "só provedores gratuitos" mora no banco (ia.somente_gratuitos,
// lib/ai/chaves.ts) e é espelhada nesta variável de ambiente para o código
// síncrono. A regra: só "off" libera o pago. Variável ausente (função que
// acabou de subir e ainda não leu o banco), vazia ou com qualquer outro valor
// = TRAVADA. Na dúvida, não gasta (CLAUDE.md §3).
//
// Antes, a trava só valia para o texto (llmTexto). Leitura de imagem/PDF, o
// agente do chat, o Cérebro (Anthropic direto), a arte da OpenAI e a
// transcrição de áudio pela OpenAI passavam por fora — e caíam no pago
// exatamente nos dias em que o gratuito batia no limite. Todos consultam
// esta função agora.

export const VAR_SOMENTE_GRATUITOS = "IA_SOMENTE_GRATUITOS";

/** Pode chamar provedor PAGO (OpenAI, Anthropic, DeepSeek)? Só com a trava desligada de propósito. */
export function pagoLiberado(): boolean {
  return process.env[VAR_SOMENTE_GRATUITOS] === "off";
}

/** Para mensagens de erro: por que o provedor pago configurado não foi usado. */
export const AVISO_TRAVA_PAGO =
  "o provedor pago está bloqueado pela trava de gasto (ZEUS → Chaves de IA → \"Só provedores gratuitos\")";
