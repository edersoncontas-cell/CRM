// Adapter de transcrição de áudio (áudio do WhatsApp -> texto).
// Stub por enquanto; ativa quem implementar Whisper/serviço de transcrição.

export function isEnabled() {
  return false; // ativar quando houver provedor de transcrição configurado
}

export async function transcrever(_audioUrl: string): Promise<string> {
  if (!isEnabled()) {
    throw new Error(
      "Transcrição de áudio ainda não conectada. Cole a transcrição manualmente por enquanto."
    );
  }
  return "";
}
