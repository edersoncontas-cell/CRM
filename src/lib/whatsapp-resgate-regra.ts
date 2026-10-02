// RESGATE DE MENSAGENS — regras puras (sem banco, sem rede).
//
// 02/10: "desconectei, conectei, mandei mensagem de outro telefone e não
// chegou". Daqui não dá para ver a Evolution dele; o CRM, lá na Vercel, dá.
// Uma mensagem pode parar em três lugares, e cada um tem saída diferente:
//   1. nem chega na Evolution  → o WhatsApp não entrega para ela (conexão
//      morta por dentro, ou a Evolution do servidor com defeito);
//   2. chega na Evolution, mas o aviso (webhook) não vem ao CRM → o CRM puxa
//      direto da Evolution (o "resgate") e reaponta o webhook;
//   3. chega ao CRM e é descartada → o motivo está em "Últimos eventos".
// Aqui ficam: quais mensagens puxar, a memória do que já foi visto e a
// conclusão do "Testar recebimento".

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

/** Hora da mensagem em ms. A Evolution manda segundos (às vezes texto, às vezes um Long {low, high}). */
export function horaDoRegistro(r: Obj): number {
  let v: unknown = r.messageTimestamp;
  const o = obj(v);
  if (o && typeof o.low === "number") v = o.low >>> 0;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

export function idDoRegistro(r: Obj): string | null {
  const k = obj(r.key);
  const id = k?.id;
  return typeof id === "string" && id ? id : null;
}

export function remoteJidDoRegistro(r: Obj): string {
  const k = obj(r.key);
  return typeof k?.remoteJid === "string" ? k.remoteJid : "";
}

export function ehDeOutraPessoa(r: Obj): boolean {
  return obj(r.key)?.fromMe !== true;
}

/** Story, status e lista de transmissão nunca viram conversa — nem entram na conta. */
export function ehConversa(r: Obj): boolean {
  const jid = remoteJidDoRegistro(r);
  return !!jid && !jid.endsWith("@broadcast");
}

export type Memoria = { vistos: string[]; ultimaVez: number | null };
export const MEMORIA_VAZIA: Memoria = { vistos: [], ultimaVez: null };
const MAX_VISTOS = 400;

export function lerMemoria(valor: string | null | undefined): Memoria {
  if (!valor) return MEMORIA_VAZIA;
  try {
    const o = JSON.parse(valor) as Partial<Memoria>;
    return {
      vistos: Array.isArray(o.vistos) ? o.vistos.filter((x): x is string => typeof x === "string").slice(-MAX_VISTOS) : [],
      ultimaVez: typeof o.ultimaVez === "number" && Number.isFinite(o.ultimaVez) ? o.ultimaVez : null,
    };
  } catch {
    return MEMORIA_VAZIA;
  }
}

/** `agora` null = quem puxou não foi o vigia (o teste): a hora da última passada dele fica. */
export function memoriaDepois(m: Memoria, novos: string[], agora: number | null): Memoria {
  const set = new Set(m.vistos);
  const vistos = [...m.vistos];
  for (const id of novos) if (!set.has(id)) { set.add(id); vistos.push(id); }
  return { vistos: vistos.slice(-MAX_VISTOS), ultimaVez: agora ?? m.ultimaVez };
}

/**
 * Janela que o vigia olha: desde a última passada (com folga de 10 min), mas
 * nunca mais de 2 h para trás. Mais que isso já não é "mensagem que o webhook
 * perdeu agora" — é histórico, e a importação de conversas cuida dele; e cada
 * mensagem puxada passa pela análise da IA, como se tivesse acabado de chegar.
 */
export const JANELA_MAX_MS = 2 * 60 * 60_000;
export function inicioDaJanela(m: Memoria, agora: number): number {
  const limite = agora - JANELA_MAX_MS;
  if (!m.ultimaVez) return agora - 30 * 60_000;
  return Math.max(limite, m.ultimaVez - 10 * 60_000);
}

/**
 * Quais registros da Evolution o CRM ainda não tem e deve puxar: dentro da
 * janela, conversa de verdade, nem no banco nem vistos antes (o que o CRM já
 * descartou — grupo, bloqueado, antiga — não é reprocessado a cada passada).
 * Do mais antigo para o mais novo, no máximo `max` por vez.
 */
export function escolherParaResgate(
  registros: Obj[],
  o: { desde: number; ate?: number; noCrm: Set<string>; vistos: Set<string>; max: number },
): Obj[] {
  const vistos = new Set<string>();
  const saida: Obj[] = [];
  for (const r of registros) {
    const id = idDoRegistro(r);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    if (!ehConversa(r)) continue;
    if (horaDoRegistro(r) < o.desde) continue;
    if (o.ate !== undefined && horaDoRegistro(r) >= o.ate) continue;
    if (o.noCrm.has(id) || o.vistos.has(id)) continue;
    saida.push(r);
  }
  saida.sort((a, b) => horaDoRegistro(a) - horaDoRegistro(b));
  return saida.slice(0, o.max);
}

// ── Testar recebimento ──────────────────────────────────────────────────────

export type EventoVisto = { status: string; via?: string; dir: string };

export type EntradaConclusao = {
  /** A Evolution respondeu à consulta das mensagens guardadas? */
  evolutionRespondeu: boolean;
  erroEvolution?: string | null;
  /** Total que ela guarda (0 = não guarda mensagens; null = não se sabe). */
  evolutionGuarda: number | null;
  /** Mensagens de OUTRA pessoa que a Evolution recebeu desde o início do teste. */
  recebidasNaEvolution: number;
  /** Dessas, quantas o CRM ainda não tem (nem pelo aviso, nem puxada). */
  faltandoNoCrm: number;
  /** O que deu errado ao puxar, quando deu. */
  erroAoPuxar?: string | null;
  /** Eventos que o WEBHOOK trouxe desde o início do teste (o que foi puxado não entra aqui). */
  eventosWebhook: EventoVisto[];
  /** O que o CRM fez com cada mensagem da janela do teste que ele mesmo puxou da Evolution. */
  puxadasNaJanela: string[];
  conexao: "viva" | "morta" | "desconhecida";
  /** Já passou o tempo de espera? */
  esgotou: boolean;
};

export type Situacao =
  | "chegou"
  | "puxada"
  | "descartada"
  | "recusada-no-webhook"
  | "conexao-morta"
  | "nao-chegou-na-evolution"
  | "nao-puxou"
  | "sem-como-conferir"
  | "aguardando";

export type Conclusao = { situacao: Situacao; final: boolean; titulo: string; texto: string; refazer?: boolean };

const RECUSA_WEBHOOK = new Set(["chave-recusada", "outra-instancia"]);
const DESCARTE = new Set(["grupo", "status", "sem-texto", "sem-telefone", "antiga", "bloqueado"]);

export function concluirTeste(e: EntradaConclusao): Conclusao {
  const recebidos = e.eventosWebhook.filter((x) => x.dir === "in");

  if (recebidos.some((x) => x.status === "recebida")) {
    return { situacao: "chegou", final: true, titulo: "Chegou! O recebimento está funcionando.", texto: "A Evolution recebeu e avisou o CRM na hora. A mensagem já está no Atendimento." };
  }
  if (e.puxadasNaJanela.includes("recebida")) {
    return {
      situacao: "puxada", final: true,
      titulo: "A Evolution recebeu, mas não avisou o CRM — o CRM puxou a mensagem.",
      texto: "A mensagem já está no Atendimento. O aviso da Evolution (webhook) não chegou até o CRM, então o CRM reapontou o webhook e, até ele voltar a funcionar, puxa sozinho da Evolution o que não chegar (a cada passada do vigia).",
    };
  }
  const recusa = e.eventosWebhook.find((x) => RECUSA_WEBHOOK.has(x.status));
  if (recusa) {
    return {
      situacao: "recusada-no-webhook", final: true,
      titulo: "A Evolution avisou o CRM, mas o aviso foi recusado.",
      texto: recusa.status === "chave-recusada"
        ? "O aviso chegou com uma chave que o CRM não reconhece. O CRM reapontou o webhook com a chave certa; mande outra mensagem e teste de novo."
        : "O aviso veio de outra instância da Evolution (a antiga, que travou). O CRM reapontou o webhook da instância atual; mande outra mensagem e teste de novo.",
    };
  }
  const descarte = recebidos.find((x) => DESCARTE.has(x.status) || x.status.startsWith("erro"))?.status
    ?? e.puxadasNaJanela.find((st) => DESCARTE.has(st) || st.startsWith("erro"));
  if (descarte) {
    return {
      situacao: "descartada", final: true,
      titulo: "A mensagem chegou ao CRM, mas foi deixada de fora.",
      texto: `Motivo: "${descarte}" — veja a explicação em Últimos eventos, logo abaixo nesta tela.`,
    };
  }
  if (e.recebidasNaEvolution > 0 && e.faltandoNoCrm === 0) {
    // Ela recebeu e o CRM já tem (chegou um instante antes do teste começar).
    return { situacao: "chegou", final: true, titulo: "Chegou! O recebimento está funcionando.", texto: "A Evolution recebeu e a mensagem já está no Atendimento." };
  }
  if (e.faltandoNoCrm > 0 && !e.esgotou) {
    // Ela tem a mensagem e o CRM ainda não: a próxima consulta puxa.
    return { situacao: "aguardando", final: false, titulo: "A Evolution recebeu. Trazendo para o CRM…", texto: "" };
  }
  if (e.faltandoNoCrm > 0) {
    return {
      situacao: "nao-puxou", final: true,
      titulo: "A Evolution recebeu, mas o CRM não conseguiu trazer a mensagem.",
      texto: `O aviso (webhook) não veio e puxar da Evolution também falhou${e.erroAoPuxar ? `: ${e.erroAoPuxar}` : ""}. Clique em "Configurar webhook agora" e teste de novo.`,
    };
  }
  if (e.conexao === "morta") {
    return {
      situacao: "conexao-morta", final: true, refazer: true,
      titulo: "A conexão morreu por dentro de novo: o WhatsApp não entrega nada para a Evolution.",
      texto: "A Evolution diz \"conectado\", mas o WhatsApp responde \"Connection Closed\" — por isso nada chega. Clique em \"Refazer do zero\" (o CRM cria uma conexão nova e mostra o QR). Se voltar a morrer logo depois, o defeito é da Evolution no servidor: ela precisa ser reiniciada ou atualizada.",
    };
  }
  if (!e.esgotou) {
    return { situacao: "aguardando", final: false, titulo: "Esperando a mensagem chegar…", texto: "" };
  }
  if (!e.evolutionRespondeu) {
    return {
      situacao: "sem-como-conferir", final: true,
      titulo: "Não deu para perguntar à Evolution o que ela recebeu.",
      texto: `A consulta às mensagens guardadas falhou${e.erroEvolution ? `: ${e.erroEvolution}` : ""}. Use "Diagnosticar conexão" para ver se o servidor da Evolution está no ar.`,
    };
  }
  if (e.evolutionGuarda === 0) {
    // Zero guardadas: ou ela não guarda (DATABASE_SAVE_DATA_NEW_MESSAGE
    // desligado), ou esta conexão — recém-criada, por exemplo — nunca recebeu
    // nada. Daqui não dá para separar as duas; o que fazer é o mesmo.
    return {
      situacao: "sem-como-conferir", final: true, refazer: true,
      titulo: "Nada chegou ao CRM, e a Evolution não tem nenhuma mensagem guardada nesta conexão.",
      texto: "Ou esta conexão nunca recebeu mensagem nenhuma — e aí o WhatsApp não está entregando para ela —, ou a Evolution do servidor não guarda mensagens (DATABASE_SAVE_DATA_NEW_MESSAGE desligado) e não dá para conferir por ela. Confira se mandou para o número certo e clique em \"Refazer do zero\". Se mesmo com a conexão nova continuar assim, o defeito é da Evolution no servidor (reiniciar ou atualizar a Evolution).",
    };
  }
  return {
    situacao: "nao-chegou-na-evolution", final: true, refazer: true,
    titulo: "A mensagem não chegou nem na Evolution.",
    texto: "O CRM está pronto para receber, mas o WhatsApp não entregou a mensagem para a Evolution. Confira se mandou para o número certo. Se mandou, a conexão não está recebendo: clique em \"Refazer do zero\". Se mesmo com conexão nova continuar assim, o defeito é da Evolution no servidor (reiniciar ou atualizar a Evolution).",
  };
}

/** Resposta de cada consulta do "Testar recebimento" (lib/whatsapp-recebimento-actions.ts). */
export type ResultadoTeste = {
  conclusao: Conclusao;
  conexao: "viva" | "morta" | "desconhecida";
  detalheConexao: string;
  /** Mensagens que a Evolution tem desde o início do teste (número só com os 4 últimos dígitos). */
  naEvolution: { deOutraPessoa: boolean; numero: string; hora: string; noCrm: boolean }[];
  /** Eventos que o CRM registrou desde o início do teste. */
  eventos: { em: string; status: string; via?: string; dir: string; numero: string }[];
  puxadas: number;
  /** Na primeira consulta: mensagens das últimas 24 h que estavam na Evolution e não no CRM, trazidas agora. */
  atrasadasPuxadas: number;
  webhookReapontado: boolean;
};

/** Quanto tempo o teste espera a mensagem chegar. */
export const ESPERA_TESTE_MS = 150_000;
