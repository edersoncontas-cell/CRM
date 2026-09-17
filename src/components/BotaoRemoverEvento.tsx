"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { removerEventoAction } from "@/lib/eventos-actions";

export function BotaoRemoverEvento({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [apagando, apagar] = useTransition();
  return (
    <button
      type="button"
      title="Remover evento"
      disabled={apagando}
      onClick={() => {
        if (!window.confirm(`Remover "${titulo}" da agenda?`)) return;
        apagar(async () => { await removerEventoAction(id); router.refresh(); });
      }}
      className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
    >
      {apagando ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
    </button>
  );
}
