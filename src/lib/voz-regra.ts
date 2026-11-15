// Comando por voz no Cérebro — regras PURAS (sem banco, sem navegador), usadas
// pela rota de transcrição, pelo gravador da tela e pelos testes.

export const LIMITES_VOZ = {
  bytesMax: 8 * 1024 * 1024, // mesmo teto da demanda por áudio
  segundosMax: 120,          // o gravador para sozinho aqui (comando, não palestra)
  textoMax: 2000,
} as const;

// Em ordem de preferência: o Chrome grava webm, o Safari (iPhone) só mp4.
export const MIMES_PREFERIDOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"] as const;

export function escolherMime(suporta: (mime: string) => boolean): string | undefined {
  return MIMES_PREFERIDOS.find((m) => suporta(m));
}

export function extensaoDoMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
  return "webm";
}

export type ValidacaoAudio = { ok: true } | { ok: false; erro: string };

export function validarAudio(bytes: number): ValidacaoAudio {
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, erro: "Não ouvi nada. Segure o microfone e fale o comando." };
  if (bytes > LIMITES_VOZ.bytesMax) return { ok: false, erro: "Áudio muito longo. Fale um comando mais curto." };
  return { ok: true };
}

/** Limpa o que o Whisper devolveu e corta no teto. Vazio = não entendeu. */
export function limparTranscricao(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, LIMITES_VOZ.textoMax);
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
