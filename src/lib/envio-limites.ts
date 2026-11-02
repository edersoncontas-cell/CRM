// TRAVAS DE ENVIO — o que impede o WhatsApp de ser bloqueado de novo.
//
// Escrito depois de a Meta restringir o número do vendedor por 24h, na
// sequência de um disparo para 1.298 contatos.
//
// O bloqueio não veio só do volume. Veio de quatro coisas somadas, e três
// delas moram aqui:
//
//   1. ritmo de robô — 5 mensagens a cada 0,7s; ninguém digita assim;
//   2. horário qualquer — disparo de madrugada ou domingo é assinatura de bot;
//   3. volume alto num dia só;
//   4. (a maior, e fora deste módulo) mandar para quem nunca falou com você,
//      porque quem recebe de desconhecido denuncia — e denúncia derruba número
//      muito mais rápido que volume.
//
// Módulo PURO, para a regra dar para provar sem banco e sem WhatsApp. Os
// valores são configuráveis em runtime (ver lerLimitesEnvio em
// envio-guarda.ts): quando a Meta apertar de novo, o vendedor abaixa
// o teto na hora, sem esperar deploy.

export type LimitesEnvio = {
  /** Teto por dia, somando TUDO que sai: massa, automática e manual. */
  tetoDiario: number;
  /** Janela de envio, em hora cheia de Brasília. */
  horaInicio: number;
  horaFim: number;
  /** Sábado e domingo ficam de fora quando true. */
  somenteDiasUteis: boolean;
  /** Pausa entre uma mensagem e a seguinte, sorteada nesta faixa. */
  pausaMinMs: number;
  pausaMaxMs: number;
  /**
   * Ritmo: quantas mensagens automáticas por hora, no máximo, espaçadas por
   * igual (5 por hora = uma a cada 12 min). Zero = nada sai.
   */
  porHora: number;
};

// Padrões conservadores de propósito. 80/dia é baixo para quem está
// acostumado a disparar 1.298 — e é exatamente por isso que existe: número
// restrito manda zero, e 80 por dia é infinitamente mais que zero.
export const LIMITES_PADRAO: LimitesEnvio = {
  tetoDiario: 80,
  horaInicio: 8,
  horaFim: 18,
  somenteDiasUteis: true,
  pausaMinMs: 12_000,
  pausaMaxMs: 25_000,
  porHora: 5,
};

const FUSO = "America/Sao_Paulo";

/** Hora cheia (0-23) em Brasília — o servidor roda em UTC. */
export function horaBrasilia(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hour12: false }).format(d));
}

/** Dia da semana em Brasília: 0 = domingo … 6 = sábado. */
export function diaSemanaBrasilia(d: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nome);
}

/** "2026-09-22" em Brasília — a chave do dia, para contar o teto diário. */
export function diaBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type MotivoBloqueio = "fora_do_horario" | "fim_de_semana" | "teto_diario" | null;

/**
 * Dá para mandar mais alguma agora?
 *
 * Devolve o MOTIVO quando não dá, e não só um "false": a tela precisa dizer ao
 * vendedor por que a mensagem não saiu, senão ele acha que o CRM quebrou e
 * manda na mão — que é exatamente o que derruba o número.
 */
export function porQueNaoEnviar(
  agora: Date,
  enviadasHoje: number,
  lim: LimitesEnvio = LIMITES_PADRAO
): MotivoBloqueio {
  if (lim.somenteDiasUteis) {
    const dia = diaSemanaBrasilia(agora);
    if (dia === 0 || dia === 6) return "fim_de_semana";
  }
  const h = horaBrasilia(agora);
  if (h < lim.horaInicio || h >= lim.horaFim) return "fora_do_horario";
  if (enviadasHoje >= lim.tetoDiario) return "teto_diario";
  return null;
}

export function podeEnviarAgora(agora: Date, enviadasHoje: number, lim: LimitesEnvio = LIMITES_PADRAO): boolean {
  return porQueNaoEnviar(agora, enviadasHoje, lim) === null;
}

/** Quantas ainda cabem hoje. Nunca negativo. */
export function restamHoje(enviadasHoje: number, lim: LimitesEnvio = LIMITES_PADRAO): number {
  return Math.max(0, lim.tetoDiario - enviadasHoje);
}

export function explicarBloqueio(motivo: MotivoBloqueio, lim: LimitesEnvio = LIMITES_PADRAO): string {
  switch (motivo) {
    case "fim_de_semana":
      return "Fim de semana: o robô não dispara. Disparo em fim de semana é assinatura de robô para o WhatsApp.";
    case "fora_do_horario":
      return `Fora da janela de envio (${lim.horaInicio}h às ${lim.horaFim}h de Brasília).`;
    case "teto_diario":
      return `Teto do dia atingido (${lim.tetoDiario} mensagens). O resto sai amanhã.`;
    default:
      return "";
  }
}

/**
 * A pausa até a próxima mensagem.
 *
 * Sorteada na faixa em vez de fixa, de propósito: intervalo cravado em 15s é
 * tão robótico quanto 0,7s, só mais devagar. O que parece gente é a variação.
 *
 * Recebe o sorteador para o teste dar para provar (Math.random não entra em
 * módulo que precisa ser determinístico no teste).
 */
export function pausaHumanaMs(lim: LimitesEnvio = LIMITES_PADRAO, sorteio: number = Math.random()): number {
  const faixa = Math.max(0, lim.pausaMaxMs - lim.pausaMinMs);
  return Math.round(lim.pausaMinMs + faixa * Math.min(1, Math.max(0, sorteio)));
}

// ── RITMO POR HORA ─────────────────────────────────────────────────────────
//
// "manter um padrão de envio, por exemplo enviar para 5 clientes a cada hora"
//
// A lista selecionada sai aos poucos: no máximo `porHora` mensagens em
// qualquer janela de 60 minutos, e espaçadas por igual (5 por hora = uma a
// cada 12 min). Espaçar é o ponto: 5 de uma vez e 55 minutos parado ainda é
// rajada de robô; uma a cada 12 minutos parece gente.

const HORA_MS = 3_600_000;

/** O espaço mínimo entre duas mensagens automáticas. */
export function intervaloDoRitmoMs(lim: LimitesEnvio = LIMITES_PADRAO): number {
  return lim.porHora > 0 ? Math.ceil(HORA_MS / lim.porHora) : Number.POSITIVE_INFINITY;
}

/**
 * Quando a próxima mensagem pode sair, pelo ritmo. null = pode agora.
 *
 * `recentes` são os instantes das mensagens que já saíram (qualquer ordem;
 * as de mais de uma hora atrás são ignoradas). Ritmo zerado ou inválido
 * devolve "nunca" (Infinity como data inválida não serve: devolve agora + 1
 * ano) — o padrão que não machuca é não mandar.
 */
export function proximaNoRitmo(recentes: Date[], agora: Date, lim: LimitesEnvio = LIMITES_PADRAO): Date | null {
  if (!(lim.porHora > 0) || !Number.isFinite(lim.porHora)) return new Date(agora.getTime() + 365 * 86_400_000);
  const t = agora.getTime();
  const naHora = recentes
    .map((d) => d.getTime())
    .filter((x) => Number.isFinite(x) && x > t - HORA_MS && x <= t)
    .sort((a, b) => a - b);
  let livre = t;
  if (naHora.length) livre = Math.max(livre, naHora[naHora.length - 1] + intervaloDoRitmoMs(lim));
  if (naHora.length >= lim.porHora) livre = Math.max(livre, naHora[naHora.length - lim.porHora] + HORA_MS);
  return livre > t ? new Date(livre) : null;
}

/** "10:24" em Brasília. */
function horaMinBrasilia(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false });
}

export function explicarRitmo(proxima: Date, lim: LimitesEnvio = LIMITES_PADRAO): string {
  if (!(lim.porHora > 0)) return "Ritmo de envio zerado em Configurações — nenhuma mensagem automática sai.";
  return `Ritmo de ${lim.porHora} por hora: a próxima sai por volta das ${horaMinBrasilia(proxima)}.`;
}

/**
 * Por alto, quantas horas DE JANELA a lista leva para sair no ritmo. Não conta
 * a noite nem o fim de semana: é "horas de envio", e a tela diz isso.
 */
export function horasParaTerminar(total: number, lim: LimitesEnvio = LIMITES_PADRAO): number {
  if (!(lim.porHora > 0) || total <= 0) return 0;
  return Math.ceil(total / lim.porHora);
}

/** Quantos dias úteis de janela a lista ocupa, no ritmo e no teto do dia. */
export function diasParaTerminar(total: number, lim: LimitesEnvio = LIMITES_PADRAO): number {
  if (total <= 0) return 0;
  const porDiaRitmo = Math.max(0, lim.horaFim - lim.horaInicio) * Math.max(0, lim.porHora);
  const porDia = Math.min(porDiaRitmo, Math.max(0, lim.tetoDiario));
  if (porDia <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(total / porDia);
}

/**
 * A frase que a tela mostra ANTES e DEPOIS de pôr a lista na fila: o ritmo,
 * a janela e quanto tempo leva. Sem ela ele marca 40, vê 5 saírem na primeira
 * hora e acha que o resto travou.
 */
export function descreverRitmo(total: number, lim: LimitesEnvio = LIMITES_PADRAO): string {
  if (!(lim.porHora > 0)) return "O ritmo de envio está zerado em Configurações — a lista fica na fila e nada sai até mudar.";
  const minutos = Math.round(60 / lim.porHora);
  const janela = `das ${lim.horaInicio}h às ${lim.horaFim}h${lim.somenteDiasUteis ? ", em dias úteis" : ""}`;
  const base = `Sai no ritmo de ${lim.porHora} por hora (uma a cada ${minutos} min), ${janela}.`;
  if (total <= 0) return base;
  const horas = horasParaTerminar(total, lim);
  const dias = diasParaTerminar(total, lim);
  const prazo = !Number.isFinite(dias)
    ? " Com o teto do dia zerado, nada sai."
    : dias <= 1
      ? ` ${total} ${total === 1 ? "cliente leva" : "clientes levam"} cerca de ${horas} ${horas === 1 ? "hora" : "horas"} de envio.`
      : ` ${total} clientes levam cerca de ${dias} dias de envio.`;
  return base + prazo;
}

// ── SAÍDA DA LISTA ─────────────────────────────────────────────────────────
//
// O que mais derruba número é DENÚNCIA, não volume. Quem não quer receber e
// não tem como sair só tem um botão à mão: "denunciar spam". Dar a saída é a
// trava mais barata e a que mais protege.

export const RODAPE_SAIDA = "\n\nSe não quiser mais receber, responda SAIR.";

/** Junta o rodapé sem duplicar quando o vendedor já escreveu algo parecido. */
export function comRodapeDeSaida(texto: string): string {
  const t = texto.trim();
  if (/\bSAIR\b/i.test(t)) return t;
  return t + RODAPE_SAIDA;
}

// Uma palavra solta ("sair", "parar") dentro de uma frase NÃO é pedido de
// saída: "vou sair para almoçar" e "pode parar na frente do galpão" são
// conversa normal, e marcar um cliente ativo como não-perturbe por engano
// custa venda. Por isso duas camadas, cada uma com um critério diferente.

// Camada 1 — frases que não aparecem por acaso numa conversa de venda.
// Valem em qualquer lugar do texto, de qualquer tamanho.
const FRASES_INEQUIVOCAS = [
  /\bpar[ae]r?\s+de\s+(mandar|enviar|receber)\b/,
  /\bn[ao]o\s+(quero|queira|desejo)\s+(mais\s+)?(receber|mensage|nada)/,
  /\bn[ao]o\s+(me\s+)?(mande|envie|manda|envia)\s+mais\b/,
  /\bme\s+tir[ae]\b[\s\S]{0,15}\blista\b/,
  /\bsair\s+d[ao]\s+lista\b/,
  /\bdescadastr/,
  /\bdesinscrev/,
  /\bremover\s+d[ao]\s+lista\b/,
  /\bcancelar\s+(a\s+)?(inscricao|lista)\b/,
  /\bn[ao]o\s+perturbe\b/,
];

// Camada 2 — a resposta seca. Quem quer sair responde "SAIR", não escreve
// parágrafo. Só vale em mensagem curta, e o termo tem que ABRIR a frase.
const TERMOS_SECOS = ["sair", "pare", "parar", "stop", "cancelar", "remover", "descadastrar"];
const TAMANHO_RESPOSTA_SECA = 30;

/**
 * A resposta foi um pedido para parar de receber?
 *
 * O erro caro deste módulo é o FALSO POSITIVO: cliente ativo marcado como
 * não-perturbe some das campanhas e ninguém percebe. Por isso a regra é
 * conservadora — na dúvida, não marca. Quem quiser sair e não for reconhecido
 * responde de novo, e aí quase sempre responde seco ("SAIR"), que a camada 2
 * pega.
 */
export function ehPedidoDeSaida(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!t) return false;
  const limpo = t.replace(/[.!?,;:]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpo) return false;

  if (FRASES_INEQUIVOCAS.some((re) => re.test(limpo))) return true;

  if (limpo.length <= TAMANHO_RESPOSTA_SECA) {
    if (TERMOS_SECOS.includes(limpo)) return true;
    if (TERMOS_SECOS.some((p) => limpo.startsWith(p + " "))) return true;
    if (/\bn[ao]o\s+quero\b/.test(limpo)) return true;
  }
  return false;
}

/**
 * Quem ficou de fora da campanha e POR QUÊ, em português de gente.
 *
 * O motivo importa mais que o número: "900 que nunca falaram com você" ele
 * entende e concorda; "900 removidos" ele acha que o CRM comeu os contatos e
 * manda na mão — que é justamente o que derruba o número.
 *
 * O verbo concorda com o número ("1 que pediu para sair", não "1 que
 * pediram"): erro de português na tela derruba a confiança no resto.
 */
export function motivosDeFora(c: { frios: number; pediramSaida: number; semTelefone: number }): string {
  const um = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
  return [
    c.frios ? um(c.frios, "que nunca falou com você", "que nunca falaram com você") : "",
    c.pediramSaida ? um(c.pediramSaida, "que pediu para sair", "que pediram para sair") : "",
    c.semTelefone ? um(c.semTelefone, "sem telefone", "sem telefone") : "",
  ].filter(Boolean).join(", ");
}
