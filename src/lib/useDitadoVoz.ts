// Hook de ditado por voz (Web Speech API), extraído do AssistenteIA para
// reuso pelo Modo Campo (registro de visita por voz, Fase 5) — os dois
// componentes cliente compartilham a mesma lógica de captura de fala.

import { useRef, useState } from "react";

type RecEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
type RecLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (e: RecEvent) => void; onend: () => void;
  start: () => void; stop: () => void;
};

export function useDitadoVoz(onTexto: (texto: string) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const recRef = useRef<unknown>(null);

  function alternar() {
    const SR = (typeof window !== "undefined" &&
      ((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)) || null;
    if (!SR) { alert("Seu navegador não suporta ditado por voz. Use o Chrome."); return; }
    if (ouvindo) { (recRef.current as RecLike | null)?.stop(); setOuvindo(false); return; }

    const rec = new (SR as { new (): RecLike })();
    rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e: RecEvent) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      if (t) onTexto(t);
    };
    rec.onend = () => setOuvindo(false);
    rec.start();
    recRef.current = rec;
    setOuvindo(true);
  }

  return { ouvindo, alternar };
}
