"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Botão de "atualizar agora": recarrega os dados do servidor sem F5,
// útil quando uma informação coletada (ex.: WhatsApp) demora a aparecer.
export function BotaoAtualizar({ rotulo = "Atualizar" }: { rotulo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [girando, setGirando] = useState(false);

  function atualizar() {
    setGirando(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => setGirando(false), 600);
    });
  }

  return (
    <button
      type="button"
      onClick={atualizar}
      disabled={pending}
      title="Atualizar dados"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
    >
      <RefreshCw size={16} className={girando ? "animate-spin" : ""} />
      {rotulo}
    </button>
  );
}
