// Adapter de WhatsApp Business (Meta Cloud API).
// Ativa quando WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID estiverem definidos.
// Sem credenciais: modo manual (importar/colar conversa na tela /conversas).

export function isEnabled() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function enviarMensagem(para: string, texto: string) {
  if (!isEnabled()) {
    return { ok: false, modo: "stub" as const, mensagem: "WhatsApp não conectado — rascunho não enviado." };
  }
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto },
    }),
  });
  return { ok: res.ok, modo: "live" as const, status: res.status };
}

// Baixa uma mídia recebida (áudio, imagem) via Graph API.
// Passo 1: GET /{media-id} retorna a URL temporária. Passo 2: baixar com o token.
export async function baixarMidia(
  mediaId: string,
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  if (!isEnabled()) return null;
  const token = process.env.WHATSAPP_TOKEN;

  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return null;

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) return null;

  return {
    buffer: await fileRes.arrayBuffer(),
    mimeType: meta.mime_type ?? "audio/ogg",
  };
}

export function verificarWebhook(mode: string | null, token: string | null, challenge: string | null) {
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return challenge ?? "";
  }
  return null;
}
