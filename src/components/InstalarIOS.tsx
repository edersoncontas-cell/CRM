"use client";

import { useEffect, useState } from "react";
import { Share, X, Plus } from "lucide-react";

const CHAVE = "instalar_ios_dispensado";

// Mostra uma dica de instalação SÓ no iPhone/iPad, quando o app ainda não foi
// adicionado à tela de início (o iOS não tem botão automático de instalar).
export function InstalarIOS() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE)) return;
      const ua = window.navigator.userAgent;
      const ehIOS = /iphone|ipad|ipod/i.test(ua) ||
        // iPad moderno se identifica como Mac com toque
        (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1);
      // já instalado (standalone)?
      const standalone =
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (ehIOS && !standalone) setMostrar(true);
    } catch {}
  }, []);

  if (!mostrar) return null;

  function dispensar() {
    try { localStorage.setItem(CHAVE, "1"); } catch {}
    setMostrar(false);
  }

  return (
    <div
      className="fixed inset-x-3 z-50 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-agro-400 text-sm font-black text-black">
          📲
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Instale o CRM no seu iPhone</div>
          <p className="mt-0.5 text-xs text-slate-300">
            Toque em <Share size={12} className="inline align-text-bottom" /> <b>Compartilhar</b> e depois em{" "}
            <b>&quot;Adicionar à Tela de Início&quot;</b> <Plus size={12} className="inline align-text-bottom" />.
            Vira um app de tela cheia, com notificações.
          </p>
        </div>
        <button onClick={dispensar} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
