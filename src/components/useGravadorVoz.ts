"use client";

// Gravador de comando por voz do Cérebro. Grava no navegador (MediaRecorder),
// manda para /api/cerebro/transcrever e devolve o TEXTO por `aoTexto`.
// Estados: parado → gravando → transcrevendo → parado. Falha vira `erro` (a tela
// mostra); nunca some em silêncio.

import { useCallback, useEffect, useRef, useState } from "react";
import { LIMITES_VOZ, escolherMime, extensaoDoMime } from "@/lib/voz-regra";

export type EstadoVoz = "parado" | "gravando" | "transcrevendo";

export function useGravadorVoz(aoTexto: (texto: string) => void) {
  const [estado, setEstado] = useState<EstadoVoz>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descartarRef = useRef(false);
  const aoTextoRef = useRef(aoTexto);
  aoTextoRef.current = aoTexto;

  const limpar = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (limiteRef.current) { clearTimeout(limiteRef.current); limiteRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Saiu da tela no meio da gravação: para o microfone e descarta.
  useEffect(() => () => {
    descartarRef.current = true;
    try { if (recRef.current?.state === "recording") recRef.current.stop(); } catch { /* já parado */ }
    limpar();
  }, [limpar]);

  const transcrever = useCallback(async (blob: Blob) => {
    setEstado("transcrevendo");
    try {
      const fd = new FormData();
      fd.append("audio", blob, `comando.${extensaoDoMime(blob.type)}`);
      const res = await fetch("/api/cerebro/transcrever", { method: "POST", body: fd });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; erro?: string; texto?: string } | null;
      if (!res.ok || !j?.ok || !j.texto) { setErro(j?.erro ?? "Não consegui transcrever agora. Digite o comando."); return; }
      aoTextoRef.current(j.texto);
    } catch {
      setErro("Sem conexão para enviar o áudio. Digite o comando.");
    } finally {
      setEstado("parado");
    }
  }, []);

  const alternar = useCallback(async () => {
    setErro(null);
    if (estado === "gravando") { recRef.current?.stop(); return; }
    if (estado !== "parado") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava áudio. Use o Chrome ou o Safari atualizado.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = escolherMime((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      descartarRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        limpar();
        if (descartarRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void transcrever(blob);
      };
      rec.start();
      recRef.current = rec;
      setSegundos(0);
      setEstado("gravando");
      const t0 = Date.now();
      // Relógio da tela (só estado local) e o corte automático, separados.
      timerRef.current = setInterval(() => setSegundos(Math.floor((Date.now() - t0) / 1000)), 500);
      limiteRef.current = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, LIMITES_VOZ.segundosMax * 1000);
    } catch {
      limpar();
      setErro("Não consegui acessar o microfone. Libere a permissão do navegador e tente de novo.");
    }
  }, [estado, limpar, transcrever]);

  return { estado, erro, segundos, alternar, limparErro: () => setErro(null) };
}
