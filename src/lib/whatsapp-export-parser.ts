// Parser do histórico exportado pelo WhatsApp (.txt) e de HTML já convertido em
// texto. Cobre os formatos iOS "[dd/mm/aaaa, hh:mm:ss] Fulano: msg" e Android
// "dd/mm/aaaa hh:mm - Fulano: msg". Mensagens de várias linhas são unidas.

export type RawMsg = { sender: string | null; body: string; sentAt: string };
export type ParsedChat = {
  name: string;
  isGroup: boolean;
  messages: Array<{ fromMe: boolean; sender: string | null; body: string; sentAt: string }>;
};

// Prefixo de data/hora no começo de cada mensagem (tolerante a locale e ao LRM ‎).
const TS_RE =
  /^[‎‏\s]*\[?\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\s*\]?\s*(?:[-–—]\s*)?/;

function montarData(d: string, mo: string, y: string, h: string, mi: string, s: string | undefined, ampm: string | undefined): Date {
  let dia = parseInt(d, 10);
  let mes = parseInt(mo, 10);
  // pt-BR é dd/mm; se o 1º campo > 12 é claramente dia; se o 2º > 12, é mm/dd (en-US).
  if (dia <= 12 && mes > 12) { const t = dia; dia = mes; mes = t; }
  let ano = parseInt(y, 10);
  if (ano < 100) ano += 2000;
  let hora = parseInt(h, 10);
  const min = parseInt(mi, 10);
  const seg = s ? parseInt(s, 10) : 0;
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && hora < 12) hora += 12;
    if (!pm && hora === 12) hora = 0;
  }
  return new Date(ano, mes - 1, dia, hora, min, seg);
}

// Frases de sistema que não são mensagens reais — ignoradas na importação.
const SISTEMA = /(end-to-end|ponta a ponta|criptograf]?adas|você criou|created group|adicionou|left|saiu|mudou o assunto|changed the subject|changed this group|security code|código de segurança)/i;

export function parseWhatsAppLines(text: string): RawMsg[] {
  const linhas = text.replace(/\r/g, "").split("\n");
  const msgs: RawMsg[] = [];
  let atual: RawMsg | null = null;

  for (const linha of linhas) {
    const m = linha.match(TS_RE);
    if (m) {
      if (atual) msgs.push(atual);
      const data = montarData(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
      const resto = linha.slice(m[0].length);
      // "Fulano: corpo" — separa no primeiro ": " que apareça cedo (nome curto).
      const idx = resto.indexOf(": ");
      if (idx > 0 && idx <= 60) {
        atual = { sender: resto.slice(0, idx).trim(), body: resto.slice(idx + 2), sentAt: data.toISOString() };
      } else {
        atual = { sender: null, body: resto.trim(), sentAt: data.toISOString() }; // mensagem de sistema
      }
    } else if (atual) {
      atual.body += "\n" + linha;
    }
  }
  if (atual) msgs.push(atual);

  return msgs
    .map((m) => ({ ...m, body: normalizarMidia(m.body.trim()) }))
    .filter((m) => m.sender && m.body && !SISTEMA.test(m.body));
}

// Placeholders de mídia do WhatsApp → rótulo amigável.
function normalizarMidia(b: string): string {
  if (/imagem ocultad|image omitted|<mídia|<anexad|‎image|\.jpg|\.jpeg|\.png|\.webp/i.test(b) && /ocultad|omitted|anexad|<mídia|figurinha|sticker/i.test(b)) {
    if (/figurinha|sticker/i.test(b)) return "🏷️ Figurinha";
    if (/áudio|audio|\.opus|\.mp3|ptt/i.test(b)) return "🎵 Áudio";
    if (/vídeo|video|\.mp4/i.test(b)) return "🎬 Vídeo";
    if (/documento|document|\.pdf/i.test(b)) return "📄 Documento";
    return "📷 Imagem";
  }
  return b;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Monta uma conversa: detecta grupo e marca a direção (suas mensagens = OUT).
export function montarChat(name: string, msgs: RawMsg[]): ParsedChat {
  const senders = Array.from(new Set(msgs.map((m) => m.sender).filter(Boolean) as string[]));
  const isGroup = senders.length > 2;
  // Em conversa 1:1 o chat tem o nome do contato; o OUTRO remetente é você.
  const contato = senders.find((s) => norm(s) === norm(name) || norm(name).includes(norm(s)) || norm(s).includes(norm(name)));
  return {
    name,
    isGroup,
    messages: msgs.map((m) => ({
      fromMe: isGroup ? false : !!(contato && m.sender && norm(m.sender) !== norm(contato)),
      sender: m.sender,
      body: m.body,
      sentAt: m.sentAt,
    })),
  };
}

// Deriva o nome do chat a partir do caminho do arquivo dentro do zip.
export function nomeDoArquivo(path: string): string {
  const partes = path.split("/").filter(Boolean);
  let base = partes[partes.length - 1] || path;
  // "_chat.txt" não tem nome → usa a pasta que o contém.
  if (/^_chat\.(txt|html?)$/i.test(base) && partes.length >= 2) base = partes[partes.length - 2];
  return base
    .replace(/\.(txt|html?)$/i, "")
    .replace(/^WhatsApp Chat (with|com|-)\s*/i, "")
    .replace(/^Conversa do WhatsApp com\s*/i, "")
    .trim() || base;
}
