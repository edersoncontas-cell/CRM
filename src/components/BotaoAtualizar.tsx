"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check } from "lucide-react";

// Evento ouvido pelos painéis que buscam dados sozinhos (letreiro de mercado,
// mapa de vendas): ao clicar em Atualizar, eles refazem a busca na hora.
export const EVENTO_ATUALIZAR = "crm:atualizar";

// Botão "Atualizar": rebusca os dados do servidor (router.refresh) E avisa
// os painéis ao vivo para atualizarem agora. Mostra quando terminou.
export function BotaoAtualizar({ rotulo = "Atualizar" }: { rotulo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [girando, setGirando] = useState(false);
  const [feitoEm, setFeitoEm] = useState<string | null>(null);

  function atualizar() {
    setGirando(true);
    setFeitoEm(null);
    // Painéis ao vivo (letreiro, mapa) escutam e buscam com ?forcar=1.
    const espera: Promise<unknown>[] = [];
    window.dispatchEvent(new CustomEvent(EVENTO_ATUALIZAR, { detail: { registrar: (p: Promise<unknown>) => espera.push(p) } }));
    startTransition(() => router.refresh());
    Promise.allSettled(espera).finally(() => {
      setGirando(false);
      setFeitoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setTimeout(() => setFeitoEm(null), 6000);
    });
  }

  const ocupado = pending || girando;
  return (
    <button
      type="button"
      onClick={atualizar}
      disabled={ocupado}
      title="Rebuscar tudo agora: cotações, notícias e dados do CRM"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-70"
    >
      {feitoEm && !ocupado ? <Check size={16} className="text-emerald-600" /> : <RefreshCw size={16} className={ocupado ? "animate-spin" : ""} />}
      {ocupado ? "Atualizando…" : feitoEm ? `Atualizado ${feitoEm}` : rotulo}
    </button>
  );
}
