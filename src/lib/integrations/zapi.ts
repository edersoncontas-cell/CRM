// Adapter Z-API (https://z-api.io) — WhatsApp não-oficial via QR Code.
// Vantagem: o número CONTINUA no celular (não precisa migrar p/ a Meta).
// Ativa quando ZAPI_INSTANCE_ID e ZAPI_INSTANCE_TOKEN estiverem definidos.

export function isEnabled() {
  return !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_INSTANCE_TOKEN);
}

function baseUrl() {
  const id = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_INSTANCE_TOKEN;
  return `https://api.z-api.io/instances/${id}/token/${token}`;
}

// O Client-Token é o "token de segurança da conta" do painel da Z-API,
// exigido no cabeçalho das chamadas de envio.
function headers() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.ZAPI_CLIENT_TOKEN) h["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
  return h;
}

export async function enviarMensagem(para: string, texto: string) {
  if (!isEnabled()) {
    return { ok: false, modo: "stub" as const, mensagem: "Z-API não conectada." };
  }
  const res = await fetch(`${baseUrl()}/send-text`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ phone: para.replace(/\D/g, ""), message: texto }),
  });
  let mensagemErro: string | null = null;
  if (!res.ok) {
    try {
      const body = await res.json();
      mensagemErro = body?.message ?? body?.error ?? body?.value ?? null;
    } catch {}
  }
  return { ok: res.ok, modo: "live" as const, status: res.status, mensagemErro };
}

// Baixa um áudio recebido a partir da URL fornecida pela Z-API (URL direta).
export async function baixarAudio(
  url: string
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "audio/ogg";
    return { buffer: await res.arrayBuffer(), mimeType };
  } catch {
    return null;
  }
}

// ---------- Histórico (importar conversas recentes) ----------

export type ChatZapi = { phone: string; name?: string | null; isGroup?: boolean };
export type MensagemZapi = {
  messageId: string;
  phone: string;
  fromMe: boolean;
  momentMs: number;        // timestamp em ms
  texto: string;
  tipo: "texto" | "audio" | "imagem" | "outro";
  senderName?: string | null;
};

// Lista os chats recentes da conta (para sabermos de quem importar mensagens).
export async function listarChats(): Promise<ChatZapi[]> {
  if (!isEnabled()) return [];
  try {
    const res = await fetch(`${baseUrl()}/chats`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => [])) as Record<string, unknown>[];
    if (!Array.isArray(data)) return [];
    return data.map((c) => ({
      phone: String(c.phone ?? c.id ?? "").replace(/\D/g, ""),
      name: (c.name as string) ?? (c.chatName as string) ?? null,
      isGroup: c.isGroup === true || String(c.phone ?? "").includes("-"),
    })).filter((c) => c.phone && !c.isGroup);
  } catch {
    return [];
  }
}

// Extrai texto/tipo de uma mensagem da Z-API de forma tolerante a variações.
function parseMsgZapi(m: Record<string, unknown>): MensagemZapi | null {
  const messageId = String(m.messageId ?? m.id ?? "");
  const phone = String(m.phone ?? "").replace(/\D/g, "");
  if (!messageId || !phone) return null;
  const momentMs = Number(m.momment ?? m.moment ?? m.messageTimestamp ?? 0) || Date.now();
  const txt = m.text as { message?: string } | string | undefined;
  let texto = "";
  let tipo: MensagemZapi["tipo"] = "texto";
  if (typeof txt === "string") texto = txt;
  else if (txt?.message) texto = txt.message;
  const img = m.image as { caption?: string } | undefined;
  const aud = m.audio as object | undefined;
  if (!texto && img) { texto = img.caption || "[imagem]"; tipo = "imagem"; }
  else if (!texto && aud) { texto = "[áudio]"; tipo = "audio"; }
  else if (!texto) {
    const leg = (m.video as { caption?: string })?.caption ?? (m.document as { caption?: string })?.caption;
    if (leg) texto = leg;
  }
  if (!texto) return null;
  return {
    messageId,
    phone,
    fromMe: m.fromMe === true,
    momentMs: momentMs < 1e12 ? momentMs * 1000 : momentMs, // segundos → ms se preciso
    texto,
    tipo,
    senderName: (m.senderName as string) ?? (m.chatName as string) ?? null,
  };
}

// Busca as últimas mensagens de um chat (telefone).
export async function mensagensDoChat(phone: string, amount = 20): Promise<MensagemZapi[]> {
  if (!isEnabled()) return [];
  try {
    const res = await fetch(`${baseUrl()}/chat-messages/${phone}?amount=${amount}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => [])) as Record<string, unknown>[];
    if (!Array.isArray(data)) return [];
    return data.map(parseMsgZapi).filter((m): m is MensagemZapi => m !== null);
  } catch {
    return [];
  }
}

// ---------- Conexão (QR Code estilo WhatsApp Web) ----------

export type StatusConexao = {
  configurado: boolean;       // env vars presentes?
  conectado: boolean;         // celular pareado e online?
  precisaQrCode: boolean;     // aguardando leitura do QR?
  clientTokenConfigurado: boolean; // ZAPI_CLIENT_TOKEN presente? (obrigatório p/ enviar)
  telefone?: string | null;   // número conectado
  erro?: string | null;
};

// Consulta o status da instância na Z-API.
export async function statusConexao(): Promise<StatusConexao> {
  const clientTokenConfigurado = !!process.env.ZAPI_CLIENT_TOKEN;
  if (!isEnabled()) {
    return { configurado: false, conectado: false, precisaQrCode: false, clientTokenConfigurado };
  }
  try {
    const res = await fetch(`${baseUrl()}/status`, { headers: headers(), cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as {
      connected?: boolean;
      smartphoneConnected?: boolean;
      error?: string | null;
    };
    const conectado = !!(data.connected && data.smartphoneConnected !== false);
    return {
      configurado: true,
      conectado,
      precisaQrCode: !conectado,
      clientTokenConfigurado,
      erro: data.error ?? null,
    };
  } catch (e) {
    return { configurado: true, conectado: false, precisaQrCode: true, clientTokenConfigurado, erro: String(e) };
  }
}

// Retorna o QR Code como data URL (base64) para exibir e escanear.
export async function obterQrCode(): Promise<{ imagem: string | null; erro?: string }> {
  if (!isEnabled()) return { imagem: null, erro: "Z-API não configurada." };
  try {
    const res = await fetch(`${baseUrl()}/qr-code/image`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return { imagem: null, erro: `status ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as { value?: string };
    if (!data.value) return { imagem: null, erro: "QR indisponível (talvez já conectado)." };
    // A Z-API já devolve com prefixo data:image; normaliza caso venha cru.
    const imagem = data.value.startsWith("data:") ? data.value : `data:image/png;base64,${data.value}`;
    return { imagem };
  } catch (e) {
    return { imagem: null, erro: String(e) };
  }
}

// Reinicia a instância (gera novo QR).
export async function reiniciar(): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const res = await fetch(`${baseUrl()}/restart`, { headers: headers(), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// Desconecta o número (logout do WhatsApp Web).
export async function desconectar(): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const res = await fetch(`${baseUrl()}/disconnect`, { headers: headers(), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
