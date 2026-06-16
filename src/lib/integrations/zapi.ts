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
  return { ok: res.ok, modo: "live" as const, status: res.status };
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
