// Quanto da conversa vai para a IA, e o que fazer quando ela não cabe.
//
// O problema que isto resolve: a janela era de 24 mil caracteres e o corte era
// `historico.slice(-24000)` — ou seja, ficavam só as ÚLTIMAS mensagens e o
// começo da conversa sumia. Numa venda de máquina, o começo é justamente onde
// está a qualificação: qual aplicação, qual obra, qual prazo, quanto o cliente
// pode pagar, quem decide. Jogar isso fora e analisar só o fim é o mesmo que
// entrar na reunião no minuto 50.
//
// Agora a janela é grande o bastante para a conversa inteira caber na imensa
// maioria dos casos. E, quando não couber, o corte guarda as duas pontas — o
// COMEÇO (a qualificação) e o FIM (onde a negociação está) — com um aviso no
// meio dizendo o que foi omitido, para a IA saber que existe um trecho que ela
// não viu em vez de concluir que aquilo nunca foi conversado.
//
// Módulo puro: sem banco e sem rede, para o recorte ter teste.

/**
 * Teto de caracteres do histórico enviado à IA.
 *
 * 120 mil caracteres são ~30 mil tokens — folgado para os modelos usados aqui
 * (o Gemini Flash trabalha com janela de 1 milhão) e suficiente para anos de
 * conversa de WhatsApp com um mesmo cliente.
 */
export const JANELA_HISTORICO = 120_000;

/** Quantas mensagens são buscadas no banco antes de montar o histórico. */
export const MAX_MENSAGENS = 2_000;

/** Fatia do começo quando precisa cortar: a qualificação mora aqui. */
const FATIA_INICIO = 0.35;

const AVISO = (omitidos: number) =>
  `\n\n[... ${omitidos.toLocaleString("pt-BR")} caracteres do MEIO desta conversa foram omitidos por tamanho. ` +
  `O começo e o fim estão inteiros. Se algo parecer faltar, foi omitido aqui — não conclua que nunca foi conversado. ...]\n\n`;

/**
 * Recorta o histórico guardando as duas pontas.
 *
 * Conversa que cabe passa inteira, sem tocar em nada.
 */
export function recortarHistorico(historico: string, limite: number = JANELA_HISTORICO): string {
  const t = historico ?? "";
  if (t.length <= limite) return t;

  const aviso = AVISO(t.length - limite);
  const util = Math.max(0, limite - aviso.length);
  const doInicio = Math.floor(util * FATIA_INICIO);
  const doFim = util - doInicio;

  // Corta em quebra de linha quando dá, para não partir uma mensagem no meio.
  const inicio = t.slice(0, doInicio);
  const fim = t.slice(t.length - doFim);
  const quebraInicio = inicio.lastIndexOf("\n");
  const quebraFim = fim.indexOf("\n");

  return (
    (quebraInicio > doInicio * 0.5 ? inicio.slice(0, quebraInicio) : inicio) +
    aviso +
    (quebraFim >= 0 && quebraFim < doFim * 0.5 ? fim.slice(quebraFim + 1) : fim)
  );
}
