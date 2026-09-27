// NÚMEROS DO PILOTO — as regras de contagem (puras, sem banco, testadas).
//
// São os números que voltam à diretoria depois dos 60 dias de piloto
// (docs/APRESENTACAO-DIRETORIA.md, seções 4.4 e 10). A conta que lê o banco
// mora em lib/piloto.ts; aqui fica só a RÉGUA, porque é ela que a diretoria vai
// questionar ("o que conta como resposta?") e ela não pode mudar junto com a
// consulta sem ninguém ver.

import { horaBrasilia, diaSemanaBrasilia } from "@/lib/envio-limites";

// ── Quem respondeu ──────────────────────────────────────────────────────────
// Mensagem que sai sozinha não é resposta: o envio em massa e o parabéns
// automático caem na conversa de quem estava esperando e fariam o CRM contar
// "respondido" para um cliente que continua sem resposta. Por isso esses dois
// caminhos gravam um rótulo próprio (lib/actions.ts, enviarResposta).
export const ROTULO_ENVIO_MASSA = "Envio em massa";
export const ROTULO_ANIVERSARIO = "Aniversário automático";
const NAO_E_RESPOSTA = new Set<string>([ROTULO_ENVIO_MASSA, ROTULO_ANIVERSARIO]);

export type MensagemLite = {
  direction: string;
  sentAt: Date;
  operatorDisplayName: string | null;
  sendStatus: string | null;
  body?: string | null;
  mediaType?: string | null;
  /** A rotina de nova tentativa (cron whatsapp-retry) manda depois e guarda aqui quando. */
  retryCount?: number | null;
  lastRetryAt?: Date | null;
};

/** Quando a mensagem saiu de fato: a que falhou e foi reenviada saiu na nova tentativa. */
export function quandoSaiu(m: MensagemLite): Date {
  if ((m.retryCount ?? 0) > 0 && m.lastRetryAt && m.lastRetryAt > m.sentAt) return m.lastRetryAt;
  return m.sentAt;
}

/**
 * Resposta do vendedor: saiu (pelo CRM ou pelo celular), não falhou e não é
 * automática. Rascunho não chega aqui (a consulta já tira). O rascunho do
 * Orientador que ele aprovou conta: foi ele quem mandou.
 */
export function ehRespostaDoVendedor(m: MensagemLite): boolean {
  return m.direction === "OUT" && m.sendStatus !== "FAILED" && !NAO_E_RESPOSTA.has(m.operatorDisplayName ?? "");
}

// ── Mensagem que não pede resposta ──────────────────────────────────────────
// "Ok", "obrigado", "👍", figurinha: o cliente encerrou, não perguntou. Sem
// esta régua, todo "valeu" viraria um cliente "sem resposta" para sempre — e o
// próximo assunto, dias depois, contaria como resposta demorada.
//
// Mais estreita que a mensagemTrivial do Orientador de propósito: lá "oi",
// "bom dia" e "qual valor?" podem ser pulados (só decide se vale gastar IA);
// aqui "bom dia" de cliente novo ESPERA resposta, e é justamente o número que
// a diretoria quer ver.
const SO_EMOJI_OU_PONTUACAO = /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}\p{P}\p{S}]*$/u;
const PALAVRAS_DE_CORTESIA = new Set([
  "ok", "okay", "oks", "okk", "blz", "blza", "beleza", "obrigado", "obrigada", "obrigadao", "obg", "obgd", "brigado", "brigada",
  "grato", "grata", "muito", "mto", "valeu", "vlw", "show", "top", "certo", "ta", "tabom", "bom", "combinado", "fechado",
  "perfeito", "otimo", "joia", "tmj", "de", "nada", "disponha", "amem", "entendi", "ah", "aham", "uhum",
  "kk", "kkk", "kkkk", "kkkkk", "rs", "rsrs", "haha", "hahaha", "pela", "atencao", "abraco", "abs",
]);
const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function ehSoCortesia(texto: string | null | undefined, mediaType?: string | null): boolean {
  const t = (texto ?? "").trim();
  if (mediaType === "sticker") return true;
  // Foto, vídeo, documento ou áudio sem texto podem ser a máquina, o
  // orçamento, a pergunta falada: esperam resposta.
  if (!t) return !mediaType;
  if (t.includes("?")) return false;
  if (SO_EMOJI_OU_PONTUACAO.test(t)) return true;
  const palavras = normalizar(t).split(" ").filter(Boolean);
  if (!palavras.length) return true;
  // "ok obrigado pela atenção" é cortesia; "ok, amanhã passo aí" não é.
  return palavras.length <= 5 && palavras.every((p) => PALAVRAS_DE_CORTESIA.has(p));
}

// ── Esperas ─────────────────────────────────────────────────────────────────
// Uma ESPERA começa quando o cliente escreve e ninguém respondeu ainda, e
// acaba na primeira resposta do vendedor. Três mensagens seguidas do cliente
// são uma espera só, contada da primeira.

export type Espera = {
  chegou: Date;
  respondida: Date | null;
  /** A primeira mensagem da conversa inteira: cliente que chamou pela primeira vez. */
  primeiroContato: boolean;
  /** Ele marcou a conversa como respondida sem mandar mensagem (resolveu por telefone, por exemplo). */
  dispensada: boolean;
};

export function esperasDaConversa(
  mensagens: readonly MensagemLite[],
  opcoes: { inicioDaConversa?: Date | null; encerrada?: boolean } = {},
): Espera[] {
  const msgs = [...mensagens].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const esperas: Espera[] = [];
  let aberta: { chegou: Date; soCortesia: boolean } | null = null;
  const fechar = (respondida: Date | null, dispensada: boolean) => {
    if (aberta && !aberta.soCortesia) {
      esperas.push({
        chegou: aberta.chegou,
        respondida,
        primeiroContato: !!opcoes.inicioDaConversa && aberta.chegou.getTime() === opcoes.inicioDaConversa.getTime(),
        dispensada,
      });
    }
    aberta = null;
  };
  for (const m of msgs) {
    if (m.direction === "IN") {
      const cortesia = ehSoCortesia(m.body, m.mediaType);
      if (!aberta) aberta = { chegou: m.sentAt, soCortesia: cortesia };
      // "Obrigado" e logo depois "e o valor da entrada?": a espera vira de
      // verdade, mas conta do "obrigado" — o cliente já estava ali.
      else if (!cortesia) aberta.soCortesia = false;
    } else if (ehRespostaDoVendedor(m)) {
      fechar(quandoSaiu(m), false);
    }
  }
  // A marca de "respondido" vale só para a ÚLTIMA espera: qualquer mensagem
  // nova tira a marca (lib/whatsapp-store.ts), então ela sempre fala da última.
  if (aberta) fechar(null, opcoes.encerrada === true);
  return esperas;
}

// ── Horário comercial ───────────────────────────────────────────────────────
// Segunda a sexta, das 8h às 18h de Brasília. Mensagem que chega sábado à
// noite e é respondida segunda cedo não é demora do vendedor — misturar as
// duas faria a mediana dizer mais sobre o calendário que sobre ele.
export const HORARIO_COMERCIAL = { inicio: 8, fim: 18 } as const;

export function noHorarioComercial(d: Date): boolean {
  const dia = diaSemanaBrasilia(d);
  if (dia === 0 || dia === 6) return false;
  const h = horaBrasilia(d);
  return h >= HORARIO_COMERCIAL.inicio && h < HORARIO_COMERCIAL.fim;
}

export function mediana(valores: readonly number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

export type GrupoEsperas = {
  /** Esperas que contam (começaram no período, não dispensadas). */
  total: number;
  respondidas: number;
  /** Mediana, em minutos, entre a chegada e a primeira resposta. */
  medianaMin: number | null;
  /** Respondidas em até 1 hora. */
  ateUmaHora: number;
  /** Quantas já passaram de 1 hora (respondidas ou não): a base do "em até 1 hora". */
  baseUmaHora: number;
};

export type ResumoRespostas = {
  noHorario: GrupoEsperas;
  foraDoHorario: GrupoEsperas;
  primeiroContato: GrupoEsperas;
  semResposta: number;
  dispensadas: number;
};

function agrupar(esperas: readonly Espera[], agora: Date): GrupoEsperas {
  const respondidas = esperas.filter((e) => e.respondida);
  const minutos = respondidas.map((e) => (e.respondida!.getTime() - e.chegou.getTime()) / 60_000);
  const umaHora = 60 * 60_000;
  // Quem chegou há 10 minutos e ainda não foi respondido não é atraso ainda.
  const base = esperas.filter((e) => e.respondida || agora.getTime() - e.chegou.getTime() >= umaHora);
  return {
    total: esperas.length,
    respondidas: respondidas.length,
    medianaMin: mediana(minutos),
    ateUmaHora: minutos.filter((m) => m <= 60).length,
    baseUmaHora: base.length,
  };
}

export function resumirRespostas(esperas: readonly Espera[], inicio: Date, fim: Date, agora: Date = new Date()): ResumoRespostas {
  const doPeriodo = esperas.filter((e) => e.chegou >= inicio && e.chegou <= fim);
  const contam = doPeriodo.filter((e) => !e.dispensada);
  return {
    noHorario: agrupar(contam.filter((e) => noHorarioComercial(e.chegou)), agora),
    foraDoHorario: agrupar(contam.filter((e) => !noHorarioComercial(e.chegou)), agora),
    primeiroContato: agrupar(contam.filter((e) => e.primeiroContato), agora),
    semResposta: contam.filter((e) => !e.respondida).length,
    dispensadas: doPeriodo.length - contam.length,
  };
}

/** "8 min", "2h 10min", "1 dia 3h" — para a tela. */
export function duracaoCurta(minutos: number | null): string {
  if (minutos == null) return "—";
  const m = Math.round(minutos);
  if (m < 1) return "menos de 1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}min` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} dia${d > 1 ? "s" : ""} ${h % 24}h` : `${d} dia${d > 1 ? "s" : ""}`;
}

// ── Conversa de venda ───────────────────────────────────────────────────────
// A classificação da conversa (CLIENTE, LEAD, GRUPO, OUTRO) é o palpite da IA
// na primeira mensagem, ou a escolha dele. Venda = CLIENTE ou LEAD. O resto
// (família, fornecedor, grupo) não entra nos números — e a tela mostra
// quantas ficaram de fora, com o botão para corrigir o palpite.
export const CATEGORIAS_DE_VENDA = ["CLIENTE", "LEAD"] as const;

export function ehConversaDeVenda(category: string | null | undefined): boolean {
  return (CATEGORIAS_DE_VENDA as readonly string[]).includes(category ?? "");
}

/**
 * A negociação conta para a conversa do período quando esteve viva nele:
 * criada até o fim do período e, se já encerrada, mexida depois do início.
 * Venda antiga (lançada para histórico) não conta: não nasceu de conversa.
 */
export function negociacaoValeNoPeriodo(
  n: { criadoEm: Date; atualizadoEm: Date; status: string; negociacaoAntiga: boolean },
  inicio: Date,
  fim: Date,
): boolean {
  if (n.negociacaoAntiga) return false;
  if (n.criadoEm > fim) return false;
  return n.status === "aberta" || n.atualizadoEm >= inicio;
}

// ── Critérios para seguir (seção 10 do documento) ───────────────────────────

export const DIAS_ESFRIANDO = 10;

/** Negociação aberta sem contato há 10+ dias (o mesmo corte do alerta do ZEUS). */
export function estaEsfriando(
  n: { status: string; ultimoContato: Date | null; atualizadoEm: Date },
  agora: Date,
): boolean {
  if (n.status !== "aberta") return false;
  const ultimo = n.ultimoContato ?? n.atualizadoEm;
  return agora.getTime() - ultimo.getTime() >= DIAS_ESFRIANDO * 86_400_000;
}

// A comparação do critério 2 ("caindo pela metade") precisa do número de
// ANTES, e ele não dá para reconstruir: o último contato de cada negociação é
// sobrescrito a cada conversa. Então o CRM anota a contagem uma vez por dia.
export const CHAVE_HISTORICO_ESFRIANDO = "piloto.esfriando";
const MAX_DIAS_HISTORICO = 400;

export function lerHistoricoEsfriando(bruto: string | null | undefined): Record<string, number> {
  try {
    const obj = JSON.parse(bruto ?? "{}");
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const limpo: Record<string, number> = {};
    for (const [dia, n] of Object.entries(obj)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && typeof n === "number" && Number.isFinite(n) && n >= 0) limpo[dia] = n;
    }
    return limpo;
  } catch {
    return {};
  }
}

export function anotarDia(historico: Record<string, number>, dia: string, n: number): Record<string, number> {
  const novo = { ...historico, [dia]: n };
  const dias = Object.keys(novo).sort();
  for (const velho of dias.slice(0, Math.max(0, dias.length - MAX_DIAS_HISTORICO))) delete novo[velho];
  return novo;
}

/** A anotação mais antiga a partir de `desde` (o "começo" do período), ou null. */
export function primeiraAnotacaoDesde(historico: Record<string, number>, desde: string): { dia: string; n: number } | null {
  const dia = Object.keys(historico).sort().find((d) => d >= desde);
  return dia ? { dia, n: historico[dia] } : null;
}

export type SituacaoCriterio = "ok" | "falta" | "sem_dado";

/** Critério 1: 100% das perdidas com motivo. Sem nenhuma perdida, não há o que medir. */
export function criterioMotivos(perdidas: number, semMotivo: number): SituacaoCriterio {
  if (!perdidas) return "sem_dado";
  return semMotivo === 0 ? "ok" : "falta";
}

/** Critério 2: esfriando caiu pelo menos pela metade desde o começo. */
export function criterioEsfriando(inicio: number | null, hoje: number): SituacaoCriterio {
  if (inicio == null) return "sem_dado";
  if (inicio === 0) return hoje === 0 ? "ok" : "falta";
  return hoje <= inicio / 2 ? "ok" : "falta";
}

/** Critério 3: a MAIORIA (mais da metade) das conversas de venda com negociação. */
export function criterioConversas(conversas: number, comNegociacao: number): SituacaoCriterio {
  if (!conversas) return "sem_dado";
  return comNegociacao * 2 > conversas ? "ok" : "falta";
}

export function porcento(parte: number, todo: number): number | null {
  return todo ? Math.round((parte / todo) * 100) : null;
}

// ── Período ─────────────────────────────────────────────────────────────────
// O piloto dura 60 dias (seção 10); 30 e 90 para ver o meio do caminho e a
// sobra. Janela móvel, contada de agora para trás.
export const DIAS_PILOTO = [30, 60, 90] as const;
export const DIAS_PILOTO_PADRAO = 60;

export function diasDoPiloto(p: string | null | undefined): number {
  const n = Number(p);
  return (DIAS_PILOTO as readonly number[]).includes(n) ? n : DIAS_PILOTO_PADRAO;
}
