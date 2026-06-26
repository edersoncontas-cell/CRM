"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

// Botão de "atualizar agora": faz hard-refresh dos dados do servidor.
// Usa router.refresh() do Next.js + invalida cache do navegador via fetch no-cache.
export function BotaoAtualizar({ rotulo = "Atualizar" }: { rotulo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [girando, setGirando] = useState(false);

  async function atualizar() {
    setGirando(true);
    try {
      // Força o Next.js a rebuscar os dados do servidor
      router.refresh();
      // Aguarda um tick para o refresh propagar
      await new Promise((r) => setTimeout(r, 200));
      // Segunda chamada para garantir que os server components revalidem
      router.refresh();
    } finally {
      setTimeout(() => setGirando(false), 800);
    }
  }

  return (
    <button
      type="button"
      onClick={() => startTransition(atualizar)}
      disabled={pending || girando}
      title="Atualizar dados"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
    >
      <RefreshCw size={16} className={girando ? "animate-spin" : ""} />
      {rotulo}
    </button>
  );
}
