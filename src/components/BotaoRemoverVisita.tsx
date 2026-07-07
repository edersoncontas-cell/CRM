"use client";

import { useTransition } from "react";
import { removerVisita } from "@/lib/actions";
import { Trash2 } from "lucide-react";

export function BotaoRemoverVisita({ id, clienteId }: { id: string; clienteId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => { if (confirm("Remover esta visita?")) startTransition(() => removerVisita(id, clienteId)); }}
      disabled={pending}
      className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      title="Remover visita"
    >
      <Trash2 size={14} />
    </button>
  );
}
