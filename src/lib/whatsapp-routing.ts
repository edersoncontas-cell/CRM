// Funções PURAS de roteamento de WhatsApp (sem Prisma). Spec seção 4.

export function isGroupChatId(phone: string): boolean {
  return /@g\.us$/i.test(phone) || /^\d{8,}-(group|\d{9,})$/i.test(phone);
}

// Gera as formas equivalentes do número BR (com/sem 9º dígito, com/sem DDI 55)
// para casar a conversa independentemente de como foi salvo.
export function phoneLookupVariants(phone: string): string[] {
  if (isGroupChatId(phone)) return [phone];
  const d = phone.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return [];
  let nat = d;
  if (nat.startsWith("55") && nat.length >= 12) nat = nat.slice(2);
  const set = new Set<string>();
  const addPair = (n: string) => { if (n) { set.add(n); set.add("55" + n); } };
  addPair(nat);
  // 9º dígito (celular): nacional = DDD(2) + número
  if (nat.length === 11 && nat[2] === "9") addPair(nat.slice(0, 2) + nat.slice(3)); // remove o 9
  if (nat.length === 10) addPair(nat.slice(0, 2) + "9" + nat.slice(2));             // adiciona o 9
  set.add(d);
  return [...set].filter(Boolean);
}

// ── Identidade do contato (para travar a criação da conversa) ───────────────
// O índice único do banco é no TEXTO EXATO do externalPhone, mas a busca da
// conversa é por VARIANTES do número e pelo @lid. Quando um álbum de mídias
// chega (vários webhooks ao mesmo tempo) e dois eventos do MESMO contato
// resolvem para textos diferentes porém equivalentes — "5527999183562" e
// "552799183562", ou o telefone real e os dígitos do @lid — os dois create
// passam e nascem duas conversas. O banco não tem como barrar, porque as
// chaves são de fato diferentes.
//
// Daí estas chaves: elas são IGUAIS para todo evento do mesmo contato, e é
// nelas que a criação trava (pg_advisory_xact_lock), fazendo o segundo evento
// esperar e encontrar o que o primeiro criou.

export function somenteDigitos(s: string): string {
  return s.split("@")[0].split(":")[0].replace(/\D/g, "");
}

// Representante único do conjunto de variantes. Números equivalentes geram o
// MESMO conjunto, então ordenar e juntar dá a mesma string para os dois.
export function chaveCanonicaTelefone(phone: string): string {
  const v = phoneLookupVariants(phone);
  if (!v.length) return "";
  return [...new Set(v)].sort().join(",");
}

// Todas as chaves em que este evento precisa travar. Quando o evento traz
// telefone E @lid, ele trava nas duas: assim ele se encontra tanto com o
// evento que só tem o telefone quanto com o que só tem o @lid.
// Vem ORDENADO de propósito — todo mundo pega as travas na mesma ordem, que é
// o que evita um travar esperando o outro.
export function chavesDeIdentidade(args: { phone: string; lid?: string | null; isGroup: boolean }): string[] {
  if (args.isGroup) return [`g:${args.phone}`];
  const chaves: string[] = [];
  const tel = chaveCanonicaTelefone(args.phone);
  if (tel) chaves.push(`tel:${tel}`);
  const lid = args.lid ? somenteDigitos(args.lid) : "";
  if (lid) chaves.push(`lid:${lid}`);
  if (!chaves.length) chaves.push(`cru:${args.phone}`);
  return [...new Set(chaves)].sort();
}

// FNV-1a de 32 bits, devolvido como inteiro COM SINAL — é o que o
// pg_advisory_xact_lock(int, int) aceita.
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

type ConvMatch = { externalPhone: string } | { OR: Array<{ externalPhone: { in: string[] } } | { lid: string }> };

// `where` do Prisma para achar a conversa do evento.
export function buildConvMatch(args: { phone: string; lid?: string | null; isGroup: boolean }): ConvMatch {
  if (args.isGroup) return { externalPhone: args.phone }; // grupos: SÓ por externalPhone
  const or: Array<{ externalPhone: { in: string[] } } | { lid: string }> = [
    { externalPhone: { in: phoneLookupVariants(args.phone) } },
  ];
  if (args.lid) or.push({ lid: args.lid });
  return { OR: or };
}

// Conservador: sem instância esperada → permite; evento sem instanceId → permite.
export function isAllowedInstance(eventInstanceId: unknown, expectedInstanceId: string | null): boolean {
  if (!expectedInstanceId) return true;
  if (!eventInstanceId) return true;
  return String(eventInstanceId) === expectedInstanceId;
}

// Captura o @lid de várias chaves possíveis do evento.
export function extractLid(body: Record<string, unknown>): string | null {
  const cands = [body.senderLid, body.participantLid, body.chatLid, body.lid];
  for (const c of cands) if (c && typeof c === "string") return c;
  const phone = body.phone;
  if (typeof phone === "string" && phone.includes("@lid")) return phone;
  return null;
}

export type Conteudo = {
  text: string;
  mediaType: string | null;   // image | video | document | audio | sticker
  mediaUrl: string | null;
  mediaName: string | null;
  transcript: string | null;
};

// Extrai texto + mídia do evento (síncrono; áudio usa a transcrição embutida da Z-API).
export function extractContent(body: Record<string, unknown>): Conteudo {
  const out: Conteudo = { text: "", mediaType: null, mediaUrl: null, mediaName: null, transcript: null };
  const pick = (o: unknown, keys: string[]): string | null => {
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    for (const k of keys) if (typeof r[k] === "string" && r[k]) return r[k] as string;
    return null;
  };

  // Mídias
  const audio = body.audio as Record<string, unknown> | undefined;
  const image = body.image as Record<string, unknown> | undefined;
  const video = body.video as Record<string, unknown> | undefined;
  const doc = body.document as Record<string, unknown> | undefined;
  const sticker = body.sticker as Record<string, unknown> | undefined;

  if (audio) {
    out.mediaType = "audio";
    out.mediaUrl = pick(audio, ["audioUrl", "url", "link", "mediaUrl"]);
    out.transcript = pick(audio, ["transcription"]);
    out.text = out.transcript || "🎵 Áudio";
    return out;
  }
  if (image) {
    out.mediaType = "image";
    out.mediaUrl = pick(image, ["imageUrl", "url", "link", "mediaUrl"]);
    out.text = pick(image, ["caption"]) || "📷 Imagem";
    return out;
  }
  if (video) {
    out.mediaType = "video";
    out.mediaUrl = pick(video, ["videoUrl", "url", "link", "mediaUrl"]);
    out.text = pick(video, ["caption"]) || "🎬 Vídeo";
    return out;
  }
  if (doc) {
    out.mediaType = "document";
    out.mediaUrl = pick(doc, ["documentUrl", "url", "link", "mediaUrl"]);
    out.mediaName = pick(doc, ["fileName", "title"]);
    out.text = out.mediaName || "📄 Documento";
    return out;
  }
  if (sticker) {
    out.mediaType = "sticker";
    out.mediaUrl = pick(sticker, ["stickerUrl", "url", "link", "mediaUrl"]);
    out.text = "Figurinha";
    return out;
  }

  // Texto (4 caminhos)
  const t = body.text;
  if (t && typeof t === "object" && typeof (t as Record<string, unknown>).message === "string") {
    out.text = (t as Record<string, unknown>).message as string;
  } else if (typeof t === "string" && t) out.text = t;
  else if (typeof body.message === "string" && body.message) out.text = body.message as string;
  else if (typeof body.caption === "string" && body.caption) out.text = body.caption as string;
  return out;
}
