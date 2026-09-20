// Como a conversa é ESCRITA para a IA ler.
//
// Defeito reportado com print: o resumo dizia "Cliente enviou documentos e
// combinou contato para segunda-feira" — e o cliente não tinha enviado
// documento nenhum.
//
// A causa não era a IA ser burra: era o texto que ela recebia. O histórico era
// montado assim:
//
//     `[dd/mm hh:mm] ${direction === "OUT" ? nomeDoVendedor : "Cliente"}: ${body}`
//
// e o `body` de uma mídia é o nome do arquivo ou um emoji com rótulo (ver
// extrairConteudoEvolution: documento vira "Ficha_tecnica.pdf" ou
// "📄 Documento", imagem vira a legenda ou "📷 Imagem"). Ou seja, uma linha
// como
//
//     [15/09 10:22] Ederson: Ficha_tecnica_E145C.pdf
//
// chega à IA como se o vendedor tivesse DIGITADO o nome de um arquivo. Não há
// nada dizendo que é anexo, nem de que lado ele veio. Some-se a isso o rótulo
// "Ederson:" — um primeiro nome que o modelo não tem como saber que é o
// vendedor — e "documento apareceu na conversa" vira "o cliente mandou
// documentos" com a maior facilidade.
//
// Aqui o texto passa a dizer exatamente quem fez o quê:
//
//     [15/09 10:22] VOCÊ (vendedor): [enviou um documento: Ficha_tecnica_E145C.pdf]
//     [15/09 10:40] CLIENTE: e o prazo de entrega?
//
// Módulo puro (sem banco, sem rede), com teste.

export type MensagemHistorico = {
  direction: string;
  body: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  transcript?: string | null;
  sentAt: Date;
};

/** Os tipos de anexo que o CRM distingue. */
export type TipoMidia = "documento" | "foto" | "audio" | "video";

const POR_MEDIA_TYPE: Record<string, TipoMidia> = {
  document: "documento", image: "foto", audio: "audio", video: "video",
  photo: "foto", sticker: "foto", ptt: "audio", voice: "audio",
};

const NOME_DA_MIDIA: Record<TipoMidia, string> = {
  documento: "um documento", foto: "uma foto", audio: "um áudio", video: "um vídeo",
};

/**
 * O rótulo que abre cada linha.
 *
 * "VOCÊ (vendedor)" em vez do primeiro nome de propósito: o nome do vendedor
 * é só mais um nome próprio no meio da conversa, e o modelo confundia quem
 * tinha feito o quê. Com o rótulo fixo não há o que confundir.
 */
export function quemFalou(direction: string): "CLIENTE" | "VOCÊ (vendedor)" {
  return direction === "OUT" ? "VOCÊ (vendedor)" : "CLIENTE";
}

/** O tipo de anexo da mensagem, ou null quando é texto puro. */
export function tipoDaMidia(m: Pick<MensagemHistorico, "mediaType">): TipoMidia | null {
  const t = (m.mediaType ?? "").trim().toLowerCase();
  return POR_MEDIA_TYPE[t] ?? null;
}

/**
 * O body de uma mídia não é fala: é o nome do arquivo, a legenda ou um rótulo
 * com emoji posto pelo próprio CRM. Estes rótulos NÃO podem ir para a IA como
 * se fossem texto digitado.
 */
const ROTULO_DE_MIDIA = /^(?:📄|📷|🎵|🎬|🎤)?\s*(documento|imagem|foto|áudio|audio|vídeo|video|arquivo)\s*$/i;

/** Legenda de verdade escrita junto com o anexo (ou null quando é só rótulo). */
export function legendaDaMidia(m: Pick<MensagemHistorico, "body" | "mediaName">): string | null {
  const b = (m.body ?? "").trim();
  if (!b) return null;
  if (ROTULO_DE_MIDIA.test(b)) return null;
  // Documento: o body costuma ser o próprio nome do arquivo — isso já vai no
  // "[enviou um documento: nome]", não precisa repetir como se fosse fala.
  if (m.mediaName && b === m.mediaName.trim()) return null;
  return b;
}

/**
 * Uma linha do histórico, sem ambiguidade de autor nem de natureza.
 *
 * Mensagem sem texto vira "[mensagem sem texto]" em vez de linha vazia: linha
 * vazia é convite para o modelo preencher o buraco com invenção.
 */
export function linhaDoHistorico(m: MensagemHistorico): string {
  const data = m.sentAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = m.sentAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const quem = quemFalou(m.direction);
  const midia = tipoDaMidia(m);

  let conteudo: string;
  if (midia) {
    const nome = midia === "documento" && m.mediaName?.trim() ? `: ${m.mediaName.trim()}` : "";
    const anexo = `[enviou ${NOME_DA_MIDIA[midia]}${nome}]`;
    const transcricao = midia === "audio" && m.transcript?.trim() ? ` ${m.transcript.trim()}` : "";
    const legenda = legendaDaMidia(m);
    conteudo = `${anexo}${transcricao}${legenda ? ` ${legenda}` : ""}`;
  } else {
    conteudo = (m.body ?? "").trim() || "[mensagem sem texto]";
  }
  return `[${data} ${hora}] ${quem}: ${conteudo}`;
}

/** O histórico inteiro, mais antiga primeiro. */
export function montarHistorico(msgs: MensagemHistorico[]): string {
  return msgs.map(linhaDoHistorico).join("\n");
}

/** As últimas mensagens, sem data, para o bloco "o que acabou de acontecer". */
export function montarUltimas(msgs: MensagemHistorico[], quantas = 5): string {
  return msgs.slice(-quantas).map((m) => linhaDoHistorico(m).replace(/^\[[^\]]*\]\s*/, "")).join("\n");
}

/**
 * O que REALMENTE foi anexado na conversa, de cada lado.
 *
 * Serve de prova: o resumo não pode dizer que o cliente mandou documento se
 * não existe documento vindo dele. Ver resumo-checagem.ts.
 */
export type MidiaDaConversa = { cliente: Set<TipoMidia>; vendedor: Set<TipoMidia> };

export function midiaDaConversa(msgs: MensagemHistorico[]): MidiaDaConversa {
  const r: MidiaDaConversa = { cliente: new Set(), vendedor: new Set() };
  for (const m of msgs) {
    const t = tipoDaMidia(m);
    if (!t) continue;
    (m.direction === "OUT" ? r.vendedor : r.cliente).add(t);
  }
  return r;
}
