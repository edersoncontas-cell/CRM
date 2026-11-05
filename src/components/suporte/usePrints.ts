"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIMITES, MIMES_ACEITOS, type AnexoEntrada } from "@/lib/suporte-regra";

export type PrintLocal = AnexoEntrada & { id: string; previa: string; tamanho: number };

// Reduz a imagem no próprio aparelho antes de subir: lado maior até 1280 px,
// JPEG. Um print cru de tela passa de 1 MB; reduzido fica em ~100–300 KB.
async function reduzir(arquivo: Blob): Promise<{ base64: string; mimeType: string; tamanho: number }> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("imagem ilegível"));
      i.src = url;
    });
    const escala = Math.min(1, LIMITES.ladoMaiorPx / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.8, 0.65, 0.5]) {
      const dataUrl = canvas.toDataURL("image/jpeg", q);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const tamanho = Math.floor((base64.length * 3) / 4);
      if (tamanho <= LIMITES.bytesPorAnexo) return { base64, mimeType: "image/jpeg", tamanho };
    }
    throw new Error("grande demais");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Prints colados (Ctrl+V) ou escolhidos da galeria, já reduzidos. */
export function usePrints() {
  const [prints, setPrints] = useState<PrintLocal[]>([]);
  const [avisoPrint, setAvisoPrint] = useState<string | null>(null);
  const qtd = useRef(0);
  useEffect(() => { qtd.current = prints.length; }, [prints]);

  const adicionar = useCallback(async (arquivos: Blob[]) => {
    setAvisoPrint(null);
    for (const arq of arquivos) {
      if (!(MIMES_ACEITOS as readonly string[]).includes(arq.type) && !arq.type.startsWith("image/")) {
        setAvisoPrint("Só imagens podem ser coladas aqui.");
        continue;
      }
      if (qtd.current >= LIMITES.anexosPorMensagem) { setAvisoPrint(`No máximo ${LIMITES.anexosPorMensagem} prints por mensagem.`); break; }
      try {
        const r = await reduzir(arq);
        const id = Math.random().toString(36).slice(2);
        qtd.current += 1;
        setPrints((atual) =>
          atual.length >= LIMITES.anexosPorMensagem
            ? atual
            : [...atual, { id, nome: `print-${atual.length + 1}.jpg`, ...r, previa: `data:${r.mimeType};base64,${r.base64}` }],
        );
      } catch {
        setAvisoPrint("Não consegui ler esse print. Tente colar de novo ou anexar pelo botão.");
      }
    }
  }, []);

  /** Para o onPaste do campo: pega só as imagens; texto colado segue normal. */
  const aoColar = useCallback((e: React.ClipboardEvent) => {
    const imagens = Array.from(e.clipboardData?.items ?? [])
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f);
    if (imagens.length) {
      e.preventDefault();
      void adicionar(imagens);
    }
  }, [adicionar]);

  const remover = useCallback((id: string) => setPrints((p) => p.filter((x) => x.id !== id)), []);
  const limpar = useCallback(() => { setPrints([]); setAvisoPrint(null); }, []);
  const paraEnvio = useCallback(
    () => prints.map(({ mimeType, nome, base64 }) => ({ mimeType, nome, base64 })),
    [prints],
  );

  return { prints, avisoPrint, adicionar, aoColar, remover, limpar, paraEnvio };
}

/** Enter envia, Shift+Enter quebra linha. */
export function enterEnvia(e: React.KeyboardEvent, enviar: () => void) {
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    enviar();
  }
}

export async function postarSuporte(corpo: Record<string, unknown>): Promise<{ ok: boolean; erro?: string; ticketId?: string }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, erro: "Sem internet: o pedido não foi enviado. O texto continua aqui; envie quando o sinal voltar." };
  }
  try {
    const r = await fetch("/api/suporte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) return { ok: false, erro: j?.erro ?? `Não foi enviado (erro ${r.status}). Tente de novo.` };
    return { ok: true, ticketId: j.ticketId };
  } catch {
    return { ok: false, erro: "Não foi enviado: a conexão caiu. O texto continua aqui; tente de novo." };
  }
}
