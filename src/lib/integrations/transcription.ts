// Adapter de transcrição de áudio (áudio do WhatsApp -> texto).
// Suporta Groq Whisper (GROQ_API_KEY, grátis) e OpenAI Whisper (OPENAI_API_KEY).
// Sem chave: lança erro e o áudio fica salvo aguardando transcrição manual.

type Provedor = { url: string; key: string; model: string };

function provedor(): Provedor | null {
  if (process.env.GROQ_API_KEY) {
    return {
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      key: process.env.GROQ_API_KEY,
      model: "whisper-large-v3",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      url: "https://api.openai.com/v1/audio/transcriptions",
      key: process.env.OPENAI_API_KEY,
      model: "whisper-1",
    };
  }
  return null;
}

export function isEnabled() {
  return provedor() !== null;
}

// Transcreve a partir dos bytes do áudio (como recebidos do WhatsApp).
export async function transcreverBuffer(
  audio: ArrayBuffer,
  mimeType = "audio/ogg",
): Promise<string> {
  const p = provedor();
  if (!p) {
    throw new Error(
      "Transcrição de áudio não conectada. Defina GROQ_API_KEY (grátis) ou OPENAI_API_KEY.",
    );
  }

  const ext = mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : "ogg";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), `audio.${ext}`);
  form.append("model", p.model);
  form.append("language", "pt");

  const res = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}` },
    body: form,
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha na transcrição (${res.status}): ${detalhe.slice(0, 200)}`);
  }

  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
