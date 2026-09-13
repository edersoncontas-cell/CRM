// Normalização dos payloads da Evolution API (open source, grátis) para o
// formato interno do CRM — funções PURAS (sem Prisma), espelhando o papel de
// whatsapp-routing.ts para a Z-API.
//
// Formato do webhook (v2): { event: "messages.upsert", instance, apikey,
//   data: { key: { remoteJid, fromMe, id, participant?, senderPn? }, pushName,
//           message: { conversation | extendedTextMessage | audioMessage | … , base64? },
//           messageType, messageTimestamp } }

import type { Conteudo } from "@/lib/whatsapp-routing";

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const digitos = (jid: string): string => jid.split("@")[0].split(":")[0].replace(/\D/g, "");

// Mensagens efêmeras / visualização única / documento com legenda vêm
// "embrulhadas" num nível a mais — desembrulha até achar o conteúdo real.
function desembrulhar(message: Obj | null): Obj | null {
  const WRAPPERS = [
    "ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
    "documentWithCaptionMessage", "editedMessage",
  ];
  let m = message;
  for (let i = 0; i < 4 && m; i++) {
    const wrapper = WRAPPERS.map((k) => obj(m![k])).find(Boolean);
    const interna = wrapper ? obj(wrapper.message) : null;
    if (!interna) break;
    m = interna;
  }
  return m;
}

export type ConteudoEvolution = Conteudo & { base64: string | null; mimeType: string | null };

// Extrai texto + tipo de mídia. As URLs de mídia da Evolution são as do
// próprio WhatsApp (criptografadas, .enc) — inúteis pro navegador, por isso
// mediaUrl fica null; áudio chega em base64 quando WEBHOOK_BASE64=true na
// Evolution (é assim que transcrevemos).
export function extrairConteudoEvolution(messageRaw: unknown): ConteudoEvolution {
  const out: ConteudoEvolution = { text: "", mediaType: null, mediaUrl: null, mediaName: null, transcript: null, base64: null, mimeType: null };
  const bruto = obj(messageRaw);
  const m = desembrulhar(bruto);
  if (!m) return out;
  out.base64 = str(bruto?.base64) ?? str(m.base64);

  const audio = obj(m.audioMessage);
  if (audio) {
    out.mediaType = "audio";
    out.mimeType = str(audio.mimetype) ?? "audio/ogg";
    out.text = "🎵 Áudio";
    return out;
  }
  const image = obj(m.imageMessage);
  if (image) {
    out.mediaType = "image";
    out.mimeType = str(image.mimetype);
    out.text = str(image.caption) || "📷 Imagem";
    return out;
  }
  const video = obj(m.videoMessage);
  if (video) {
    out.mediaType = "video";
    out.mimeType = str(video.mimetype);
    out.text = str(video.caption) || "🎬 Vídeo";
    return out;
  }
  const doc = obj(m.documentMessage);
  if (doc) {
    out.mediaType = "document";
    out.mimeType = str(doc.mimetype);
    out.mediaName = str(doc.fileName) ?? str(doc.title);
    out.text = str(doc.caption) || out.mediaName || "📄 Documento";
    return out;
  }
  if (obj(m.stickerMessage)) {
    out.mediaType = "sticker";
    out.text = "Figurinha";
    return out;
  }
  const loc = obj(m.locationMessage) ?? obj(m.liveLocationMessage);
  if (loc) {
    out.text = `📍 Localização${str(loc.name) ? ": " + str(loc.name) : ""}`;
    return out;
  }
  const contato = obj(m.contactMessage);
  if (contato) {
    out.text = `👤 Contato: ${str(contato.displayName) ?? ""}`.trim();
    return out;
  }
  const enquete = obj(m.pollCreationMessage) ?? obj(m.pollCreationMessageV3);
  if (enquete) {
    out.text = `📊 Enquete: ${str(enquete.name) ?? ""}`.trim();
    return out;
  }
  // reactionMessage / protocolMessage / etc.: sem texto -> ignorado pelo webhook
  const texto = str(m.conversation) ?? str(obj(m.extendedTextMessage)?.text);
  if (texto) out.text = texto;
  return out;
}

export type ChaveEvolution = {
  remoteJid: string;
  fromMe: boolean;
  id: string | null;
  participant: string | null;
  isGroup: boolean;
  lid: string | null;
  phone: string; // dígitos do telefone, ou JID do grupo, ou dígitos do @lid quando não há telefone
};

// Resolve telefone/grupo/lid a partir de data.key. Contatos "@lid" (id
// anônimo do WhatsApp) trazem o telefone real em senderPn/remoteJidAlt nas
// versões mais novas da Evolution; sem isso, o próprio lid vira o
// identificador (mesmo comportamento do webhook da Z-API).
export function normalizarChaveEvolution(data: Obj): ChaveEvolution | null {
  const key = obj(data.key);
  if (!key) return null;
  const remoteJid = str(key.remoteJid) ?? "";
  if (!remoteJid) return null;
  const isGroup = remoteJid.endsWith("@g.us");
  const ehLid = remoteJid.endsWith("@lid");
  const alt = str(key.senderPn) ?? str(key.remoteJidAlt) ?? str(data.senderPn) ?? null;

  let phone: string;
  if (isGroup) phone = remoteJid;
  else if (ehLid) phone = alt ? digitos(alt) : digitos(remoteJid);
  else phone = digitos(remoteJid) || remoteJid;

  return {
    remoteJid,
    fromMe: key.fromMe === true,
    id: str(key.id),
    participant: str(key.participant),
    isGroup,
    lid: ehLid ? remoteJid : null,
    phone,
  };
}

// Status de entrega (evento messages.update) -> status interno do CRM.
export const STATUS_EVOLUTION: Record<string, string> = {
  SERVER_ACK: "SENT",
  DELIVERY_ACK: "DELIVERED",
  READ: "READ",
  PLAYED: "READ",
};

// Converte um registro de /chat/findMessages para o formato "estilo Z-API"
// que a importação de histórico (parseHist em import-history) já entende.
export function mensagemEvolutionParaZapi(record: Obj): Obj {
  const chave = normalizarChaveEvolution(record);
  const c = extrairConteudoEvolution(record.message);
  const ts = Number(record.messageTimestamp ?? 0) || 0;
  const out: Obj = {
    messageId: chave?.id ?? "",
    fromMe: chave?.fromMe ?? false,
    momment: ts,
    senderName: str(record.pushName),
  };
  if (c.mediaType === "image") out.image = { caption: c.text === "📷 Imagem" ? "" : c.text };
  else if (c.mediaType === "audio") out.audio = { transcription: "" };
  else if (c.mediaType === "video") out.video = {};
  else if (c.mediaType === "document") out.document = { fileName: c.mediaName ?? "" };
  else if (c.text) out.text = { message: c.text };
  return out;
}
