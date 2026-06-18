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

// ---------- Conexão (QR Code estilo WhatsApp Web) ----------

export type StatusConexao = {
  configurado: boolean;       // env vars presentes?
  conectado: boolean;         // celular pareado e online?
  precisaQrCode: boolean;     // aguardando leitura do QR?
  telefone?: string | null;   // número conectado
  erro?: string | null;
};

// Consulta o status da instância na Z-API.
export async function statusConexao(): Promise<StatusConexao> {
  if (!isEnabled()) {
    return { configurado: false, conectado: false, precisaQrCode: false };
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
      erro: data.error ?? null,
    };
  } catch (e) {
    return { configurado: true, conectado: false, precisaQrCode: true, erro: String(e) };
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
